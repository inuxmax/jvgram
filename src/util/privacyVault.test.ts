import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  BASE_LOCKOUT_MS,
  createMemoryPrivacyStorage,
  createPrivacyVault,
  FILTER_SNAPSHOT_KEY,
  MAX_FAILED_ATTEMPTS,
} from './privacyVault';

function createVault(overrides: Parameters<typeof createPrivacyVault>[0] = {}) {
  return createPrivacyVault({
    storage: createMemoryPrivacyStorage(),
    getAccountId: () => '1',
    noDom: true,
    ...overrides,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  if (typeof localStorage === 'object') {
    localStorage.removeItem(FILTER_SNAPSHOT_KEY);
  }
});

describe('Hidden chat', () => {
  test('hide chat', async () => {
    const vault = createVault();
    await vault.hideChat('1', '100');
    expect(vault.isChatHidden('1', '100')).toBe(true);
  });

  test('unhide chat', async () => {
    const vault = createVault();
    await vault.hideChat('1', '100');
    await vault.unhideChat('1', '100');
    expect(vault.isChatHidden('1', '100')).toBe(false);
  });

  test('hidden chat disappears from chat list', async () => {
    const vault = createVault();
    const chats = [{ id: '100' }, { id: '200' }];
    await vault.hideChat('1', '100');
    expect(vault.getVisibleChats('1', chats)).toEqual([{ id: '200' }]);
    expect(vault.filterHiddenChatIds('1', ['100', '200'])).toEqual(['200']);
  });

  test('hidden chat remains in Telegram', async () => {
    const vault = createVault();
    const chats = [{ id: '100' }, { id: '200' }];
    await vault.hideChat('1', '100');
    vault.getVisibleChats('1', chats);
    expect(chats).toEqual([{ id: '100' }, { id: '200' }]);
  });

  test('hidden chat does not appear in search', async () => {
    const vault = createVault();
    await vault.hideChat('1', '100');
    expect(vault.filterHiddenSearchResults(['100_11', '200_12'])).toEqual(['200_12']);
    await vault.setHideFromSearch(false);
    expect(vault.filterHiddenSearchResults(['100_11', '200_12'])).toEqual(['100_11', '200_12']);
  });

  test('hidden chat does not trigger notification', async () => {
    const vault = createVault();
    await vault.hideChat('1', '100');
    expect(vault.shouldSuppressNotification('1', '100')).toBe(true);
    expect(vault.shouldHideNotificationPreview('1', '100')).toBe(true);
    expect(vault.shouldSuppressNotification('1', '200')).toBe(false);
    await vault.setHideNotifications(false);
    expect(vault.shouldSuppressNotification('1', '100')).toBe(false);
  });

  test('hidden chat appears after vault unlock', async () => {
    const vault = createVault();
    await vault.hideChat('1', '100');
    await vault.setPin('2491');
    vault.lockVault();
    expect(vault.getHiddenChats('1').map((item) => item.chatId)).toEqual(['100']);
    expect(await vault.unlockVault('2491')).toBe(true);
    expect(vault.isVaultUnlocked()).toBe(true);
    expect(vault.getHiddenChats('1')[0].chatId).toBe('100');
    expect(vault.shouldBlockOpenChat('100')).toBe(false);
    expect(vault.filterHiddenChatIds('1', ['100', '200'])).toEqual(['100', '200']);
    expect(vault.filterHiddenSearchResults(['100_11', '200_12'])).toEqual(['100_11', '200_12']);
  });

  test('hidden chat stays out of search until the vault is unlocked', async () => {
    const vault = createVault();
    await vault.hideChat('1', '100');
    await vault.setPin('2491');
    vault.lockVault();
    expect(vault.filterHiddenChatIds('1', ['100', '200'])).toEqual(['200']);
    expect(vault.filterHiddenSearchResults(['100_11', '200_12'])).toEqual(['200_12']);
    expect(await vault.unlockVault('2491')).toBe(true);
    expect(vault.filterHiddenPeerIds(['100', '200'])).toEqual(['100', '200']);
  });
});

describe('Hidden account', () => {
  test('hide account', async () => {
    const vault = createVault();
    await vault.hideAccount('2');
    expect(vault.isAccountHidden('2')).toBe(true);
  });

  test('unhide account', async () => {
    const vault = createVault();
    await vault.hideAccount('2');
    await vault.unhideAccount('2');
    expect(vault.isAccountHidden('2')).toBe(false);
  });

  test('account disappears from switcher', async () => {
    const vault = createVault();
    await vault.hideAccount('2');
    expect(vault.getVisibleAccountIds(['1', '2', '3'])).toEqual(['1', '3']);
  });

  test('account remains logged in', async () => {
    const vault = createVault();
    await vault.hideChat('2', '500');
    await vault.hideAccount('2');
    expect(vault.isChatHidden('2', '500')).toBe(true);
    expect(vault.getHiddenChats('2')).toHaveLength(1);
  });

  test('hidden account appears in vault', async () => {
    const vault = createVault();
    await vault.hideAccount('2');
    expect(vault.getHiddenAccounts().map((item) => item.accountId)).toEqual(['2']);
  });

  test('hidden account disappears after vault lock', async () => {
    const vault = createVault();
    await vault.setPin('2491');
    await vault.hideAccount('2');
    vault.openVault();
    expect(vault.isUiOpen()).toBe(true);
    vault.lockVault();
    expect(vault.isVaultUnlocked()).toBe(false);
    expect(vault.isUiOpen()).toBe(false);
    expect(vault.isAccountHidden('2')).toBe(true);
    expect(vault.getVisibleAccountIds(['1', '2'])).toEqual(['1']);
  });
});

describe('PIN', () => {
  test('create PIN', async () => {
    const vault = createVault();
    expect(await vault.setPin('2491')).toBe(true);
    expect(vault.hasPin()).toBe(true);
  });

  test('correct PIN unlocks', async () => {
    const vault = createVault();
    await vault.setPin('2491');
    vault.lockVault();
    expect(await vault.unlockVault('2491')).toBe(true);
    expect(vault.isVaultUnlocked()).toBe(true);
  });

  test('incorrect PIN fails', async () => {
    const vault = createVault();
    await vault.setPin('2491');
    vault.lockVault();
    expect(await vault.unlockVault('0000')).toBe(false);
    expect(vault.isVaultUnlocked()).toBe(false);
  });

  test('brute-force protection', async () => {
    const vault = createVault();
    await vault.setPin('2491');
    vault.lockVault();
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      expect(await vault.unlockVault('0000')).toBe(false);
    }
    expect(vault.getLockRemainingMs()).toBeGreaterThanOrEqual(BASE_LOCKOUT_MS);
    expect(await vault.unlockVault('2491')).toBe(false);
  });

  test('change PIN', async () => {
    const vault = createVault();
    await vault.setPin('2491');
    expect(await vault.setPin('8833', '2491')).toBe(true);
    vault.lockVault();
    expect(await vault.unlockVault('2491')).toBe(false);
    expect(await vault.unlockVault('8833')).toBe(true);
  });

  test('remove PIN', async () => {
    const vault = createVault();
    await vault.setPin('2491');
    expect(await vault.removePin('2491')).toBe(true);
    expect(vault.hasPin()).toBe(false);
  });
});

describe('Auto lock', () => {
  test('vault locks after timeout', async () => {
    let now = 1_000;
    const vault = createVault({ getNow: () => now });
    await vault.setPin('2491');
    await vault.setAutoLockMs(60_000);
    now = 62_000;
    vault.checkAutoLock();
    expect(vault.isVaultUnlocked()).toBe(false);
  });

  test('activity resets timeout', async () => {
    let now = 1_000;
    const vault = createVault({ getNow: () => now });
    await vault.setPin('2491');
    await vault.setAutoLockMs(60_000);
    now = 50_000;
    vault.noteActivity();
    now = 100_000;
    vault.checkAutoLock();
    expect(vault.isVaultUnlocked()).toBe(true);
    now = 111_000;
    vault.checkAutoLock();
    expect(vault.isVaultUnlocked()).toBe(false);
  });

  test('locking removes hidden UI', async () => {
    const vault = createVault();
    await vault.setPin('2491');
    vault.openVault();
    expect(vault.isUiOpen()).toBe(true);
    vault.lockVault();
    expect(vault.isUiOpen()).toBe(false);
    expect(vault.isVaultUnlocked()).toBe(false);
  });
});

describe('Panic lock', () => {
  test('shortcut locks vault', async () => {
    const vault = createVault();
    await vault.setPin('2491');
    vault.openVault();
    vault.triggerPanicLock();
    expect(vault.isVaultUnlocked()).toBe(false);
  });

  test('hidden content disappears immediately', async () => {
    const vault = createVault();
    await vault.hideChat('1', '100');
    await vault.setPin('2491');
    vault.openVault();
    vault.triggerPanicLock();
    expect(vault.isUiOpen()).toBe(false);
    expect(vault.shouldBlockOpenChat('100')).toBe(true);
    expect(vault.getVisibleChats('1', [{ id: '100' }])).toEqual([]);
  });
});

describe('Security', () => {
  test('PIN never stored plaintext', async () => {
    const storage = createMemoryPrivacyStorage();
    const vault = createVault({ storage });
    await vault.setPin('249163');
    const stored = await storage.get('state');
    const serialized = JSON.stringify(stored);
    expect(serialized).not.toContain('249163');
    expect(stored?.pinHash).toBeTruthy();
    expect(stored?.pinSalt).toBeTruthy();
  });

  test('PIN never logged', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const vault = createVault();
    await vault.setPin('2491');
    vault.lockVault();
    await vault.unlockVault('0000');
    await vault.unlockVault('2491');
    const output = [...log.mock.calls, ...error.mock.calls].flat().join(' ');
    expect(output).not.toContain('2491');
    expect(output).not.toContain('0000');
  });

  test('hidden chat title not logged', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const vault = createVault();
    await vault.hideChat('1', 'Secret Group');
    const output = log.mock.calls.flat().join(' ');
    expect(output).not.toContain('Secret Group');
  });

  test('hidden account metadata not sent to backend', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
    const vault = createVault();
    await vault.hideAccount('2');
    await vault.hideChat('1', '100');
    await vault.setPin('2491');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
