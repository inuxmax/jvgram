import { PRIVACY_IDB_STORE } from './browser/idb';
import { parseSearchResultKey, type SearchResultKey } from './keys/searchResultKey';
import { ACCOUNT_SLOT } from './multiaccount';
import { getHotkeyMatcher } from './parseHotkey';

export const PBKDF2_ITERATIONS = 100_000;
export const PIN_SALT_BYTES = 16;
export const MIN_PIN_LENGTH = 4;
export const MAX_FAILED_ATTEMPTS = 5;
export const BASE_LOCKOUT_MS = 30_000;
export const MAX_LOCKOUT_MS = 15 * 60 * 1000;
export const DEFAULT_PANIC_HOTKEY = 'Ctrl+Shift+H';
export const FILTER_SNAPSHOT_KEY = 'tt-privacy-filter';
export const PRIVACY_IDB_KEY = 'state';
export const LOCK_CHANNEL_NAME = 'tt-privacy-vault-lock';

export const AUTO_LOCK_OPTIONS = [0, 60_000, 300_000, 900_000, 1_800_000] as const;
export type AutoLockMs = (typeof AUTO_LOCK_OPTIONS)[number];

export type HiddenChat = {
  chatId: string;
  accountId: string;
  hidden: boolean;
  hiddenAt: number;
};

export type HiddenAccount = {
  accountId: string;
  hidden: boolean;
  hiddenAt: number;
};

export type PrivacyLockConfig = {
  enabled: boolean;
  pinHash: string;
  pinSalt: string;
  failedAttempts: number;
  lockedUntil?: number;
};

export type PrivacyPersistedState = {
  version: 1;
  pinHash?: string;
  pinSalt?: string;
  failedAttempts: number;
  lockedUntil?: number;
  autoLockMs: AutoLockMs;
  hideFromSearch: boolean;
  hideNotifications: boolean;
  hideNotificationPreview: boolean;
  panicHotkey: string;
  hiddenAccounts: Record<string, number>;
  hiddenChats: Record<string, Record<string, number>>;
};

export type PrivacyStorage = {
  get: (key: string) => Promise<PrivacyPersistedState | undefined>;
  set: (key: string, value: PrivacyPersistedState) => Promise<void>;
};

type Listener = NoneToVoidFunction;

type VaultOptions = {
  storage?: PrivacyStorage;
  getNow?: () => number;
  getAccountId?: () => string;
  pbkdf2Iterations?: number;
  noDom?: boolean;
};

type FilterSnapshot = {
  hiddenAccounts: string[];
  hiddenChats: Record<string, string[]>;
  hideFromSearch: boolean;
  hideNotifications: boolean;
  hideNotificationPreview: boolean;
};

const DEFAULT_STATE: PrivacyPersistedState = {
  version: 1,
  failedAttempts: 0,
  autoLockMs: 300_000,
  hideFromSearch: true,
  hideNotifications: true,
  hideNotificationPreview: true,
  panicHotkey: DEFAULT_PANIC_HOTKEY,
  hiddenAccounts: {},
  hiddenChats: {},
};

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

function isAutoLockMs(value: number): value is AutoLockMs {
  return (AUTO_LOCK_OPTIONS as readonly number[]).includes(value);
}

export function parseAutoLockMs(value: string): AutoLockMs | undefined {
  const next = Number(value);
  return isAutoLockMs(next) ? next : undefined;
}

function parsePersisted(raw: unknown): PrivacyPersistedState {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_STATE, hiddenAccounts: {}, hiddenChats: {} };
  }

  const data = raw as Partial<PrivacyPersistedState>;
  const hiddenAccounts = data.hiddenAccounts && typeof data.hiddenAccounts === 'object'
    ? { ...data.hiddenAccounts }
    : {};
  const hiddenChats: Record<string, Record<string, number>> = {};
  if (data.hiddenChats && typeof data.hiddenChats === 'object') {
    Object.entries(data.hiddenChats).forEach(([accountId, chats]) => {
      if (!chats || typeof chats !== 'object') return;
      hiddenChats[accountId] = { ...chats };
    });
  }

  return {
    version: 1,
    pinHash: typeof data.pinHash === 'string' ? data.pinHash : undefined,
    pinSalt: typeof data.pinSalt === 'string' ? data.pinSalt : undefined,
    failedAttempts: typeof data.failedAttempts === 'number' ? data.failedAttempts : 0,
    lockedUntil: typeof data.lockedUntil === 'number' ? data.lockedUntil : undefined,
    autoLockMs: typeof data.autoLockMs === 'number' && isAutoLockMs(data.autoLockMs)
      ? data.autoLockMs
      : DEFAULT_STATE.autoLockMs,
    hideFromSearch: data.hideFromSearch !== false,
    hideNotifications: data.hideNotifications !== false,
    hideNotificationPreview: data.hideNotificationPreview !== false,
    panicHotkey: typeof data.panicHotkey === 'string' && data.panicHotkey
      ? data.panicHotkey
      : DEFAULT_PANIC_HOTKEY,
    hiddenAccounts,
    hiddenChats,
  };
}

function readFilterSnapshot(): FilterSnapshot | undefined {
  if (typeof localStorage !== 'object') {
    return undefined;
  }

  try {
    const raw = localStorage.getItem(FILTER_SNAPSHOT_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as FilterSnapshot;
    if (!parsed || typeof parsed !== 'object') return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function writeFilterSnapshot(state: PrivacyPersistedState) {
  if (typeof localStorage !== 'object') {
    return;
  }

  const hiddenChats: Record<string, string[]> = {};
  Object.entries(state.hiddenChats).forEach(([accountId, chats]) => {
    hiddenChats[accountId] = Object.keys(chats);
  });

  const snapshot: FilterSnapshot = {
    hiddenAccounts: Object.keys(state.hiddenAccounts),
    hiddenChats,
    hideFromSearch: state.hideFromSearch,
    hideNotifications: state.hideNotifications,
    hideNotificationPreview: state.hideNotificationPreview,
  };

  localStorage.setItem(FILTER_SNAPSHOT_KEY, JSON.stringify(snapshot));
}

function applySnapshot(state: PrivacyPersistedState, snapshot?: FilterSnapshot) {
  if (!snapshot) return;

  snapshot.hiddenAccounts.forEach((accountId) => {
    if (state.hiddenAccounts[accountId] === undefined) {
      state.hiddenAccounts[accountId] = 0;
    }
  });
  Object.entries(snapshot.hiddenChats || {}).forEach(([accountId, chatIds]) => {
    if (!state.hiddenChats[accountId]) {
      state.hiddenChats[accountId] = {};
    }
    chatIds.forEach((chatId) => {
      if (state.hiddenChats[accountId][chatId] === undefined) {
        state.hiddenChats[accountId][chatId] = 0;
      }
    });
  });
  state.hideFromSearch = snapshot.hideFromSearch !== false;
  state.hideNotifications = snapshot.hideNotifications !== false;
  state.hideNotificationPreview = snapshot.hideNotificationPreview !== false;
}

export function createMemoryPrivacyStorage(): PrivacyStorage {
  const map = new Map<string, PrivacyPersistedState>();
  return {
    get: (key) => Promise.resolve(map.get(key)),
    set: (key, value) => {
      map.set(key, value);
      return Promise.resolve();
    },
  };
}

function createIdbPrivacyStorage(): PrivacyStorage {
  return {
    get: (key) => PRIVACY_IDB_STORE.get<PrivacyPersistedState>(key),
    set: (key, value) => PRIVACY_IDB_STORE.set(key, value),
  };
}

export async function hashPin(pin: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS) {
  const saltBuffer = new ArrayBuffer(salt.byteLength);
  new Uint8Array(saltBuffer).set(salt);
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: saltBuffer,
      iterations,
    },
    material,
    256,
  );
  return new Uint8Array(bits);
}

export function createPrivacyVault(options: VaultOptions = {}) {
  const storage = options.storage || createIdbPrivacyStorage();
  const getNow = options.getNow || (() => Date.now());
  const getAccountId = options.getAccountId || (() => String(ACCOUNT_SLOT || 1));
  const iterations = options.pbkdf2Iterations || PBKDF2_ITERATIONS;
  const listeners = new Set<Listener>();

  let persisted = parsePersisted(undefined);
  applySnapshot(persisted, readFilterSnapshot());

  let isUnlocked = false;
  let isUiOpen = false;
  let revision = 1;
  let lastActivityAt = getNow();
  let autoLockTimer: ReturnType<typeof setTimeout> | undefined;
  let isInited = false;
  let lockChannel: BroadcastChannel | undefined;
  let panicMatcher = getHotkeyMatcher(persisted.panicHotkey);

  function notify() {
    revision += 1;
    listeners.forEach((cb) => cb());
  }

  function getChatSet(accountId: string) {
    const record = persisted.hiddenChats[accountId];
    return record ? new Set(Object.keys(record)) : new Set<string>();
  }

  function getAccountSet() {
    return new Set(Object.keys(persisted.hiddenAccounts));
  }

  function persistSyncSnapshot() {
    if (options.storage) return;
    writeFilterSnapshot(persisted);
  }

  async function persist() {
    persistSyncSnapshot();
    await storage.set(PRIVACY_IDB_KEY, persisted);
  }

  function clearAutoLockTimer() {
    if (autoLockTimer !== undefined) {
      clearTimeout(autoLockTimer);
      autoLockTimer = undefined;
    }
  }

  function scheduleAutoLock() {
    clearAutoLockTimer();
    if (!isUnlocked || !persisted.autoLockMs) {
      return;
    }

    const delay = persisted.autoLockMs - (getNow() - lastActivityAt);
    autoLockTimer = setTimeout(() => {
      checkAutoLock();
    }, Math.max(0, delay));
  }

  function lockVault() {
    isUnlocked = false;
    isUiOpen = false;
    clearAutoLockTimer();
    notify();
  }

  function triggerPanicLock() {
    lockVault();
    try {
      lockChannel?.postMessage({ type: 'lock' });
    } catch {
      // BroadcastChannel is optional
    }
  }

  function checkAutoLock() {
    if (!isUnlocked || !persisted.autoLockMs) {
      return;
    }
    if (getNow() - lastActivityAt >= persisted.autoLockMs) {
      lockVault();
    } else {
      scheduleAutoLock();
    }
  }

  function noteActivity() {
    lastActivityAt = getNow();
    if (isUnlocked) {
      scheduleAutoLock();
    }
  }

  function handlePanicKey(e: KeyboardEvent) {
    if (!panicMatcher(e)) {
      return;
    }
    e.preventDefault();
    triggerPanicLock();
  }

  function handleVisibility() {
    if (typeof document !== 'object') return;
    if (document.visibilityState === 'visible') {
      noteActivity();
      checkAutoLock();
    }
  }

  function hasHiddenChat(accountId: string, chatId: string) {
    return Boolean(persisted.hiddenChats[accountId]?.[chatId] !== undefined);
  }

  function isAccountHidden(accountId: string) {
    return persisted.hiddenAccounts[accountId] !== undefined;
  }

  function shouldConcealHidden() {
    return !isUnlocked;
  }

  function filterHiddenChatIds(accountId: string, chatIds?: string[]) {
    if (!chatIds || !shouldConcealHidden()) {
      return chatIds;
    }
    const hidden = persisted.hiddenChats[accountId];
    if (!hidden) {
      return chatIds;
    }
    return chatIds.filter((chatId) => hidden[chatId] === undefined);
  }

  function listVisibleChats<T extends { id: string }>(accountId: string, chats: T[]) {
    if (!shouldConcealHidden()) {
      return chats;
    }
    const hidden = persisted.hiddenChats[accountId];
    if (!hidden) {
      return chats;
    }
    return chats.filter((chat) => hidden[chat.id] === undefined);
  }

  function excludeHiddenSearchResults<T extends SearchResultKey>(results: T[]) {
    if (!persisted.hideFromSearch || !shouldConcealHidden() || !results.length) {
      return results;
    }
    const accountId = getAccountId();
    const hidden = persisted.hiddenChats[accountId];
    if (!hidden) {
      return results;
    }
    return results.filter((key) => hidden[parseSearchResultKey(key)[0]] === undefined);
  }

  function filterHiddenPeerIds(peerIds?: string[]) {
    if (!persisted.hideFromSearch || !shouldConcealHidden()) {
      return peerIds;
    }
    return filterHiddenChatIds(getAccountId(), peerIds);
  }

  function shouldSuppressNotification(accountId: string, chatId: string) {
    return persisted.hideNotifications && hasHiddenChat(accountId, chatId);
  }

  function shouldHideNotificationPreview(accountId: string, chatId: string) {
    return persisted.hideNotificationPreview && hasHiddenChat(accountId, chatId);
  }

  function shouldBlockOpenChat(chatId: string) {
    return !isUnlocked && hasHiddenChat(getAccountId(), chatId);
  }

  function getVisibleAccountIds(accountIds: string[]) {
    if (!shouldConcealHidden() || !Object.keys(persisted.hiddenAccounts).length) {
      return accountIds;
    }
    return accountIds.filter((accountId) => persisted.hiddenAccounts[accountId] === undefined);
  }

  function getHiddenChats(accountId = getAccountId()): HiddenChat[] {
    const record = persisted.hiddenChats[accountId];
    if (!record) {
      return [];
    }
    return Object.entries(record).map(([chatId, hiddenAt]) => ({
      chatId,
      accountId,
      hidden: true,
      hiddenAt,
    }));
  }

  function getHiddenAccounts(): HiddenAccount[] {
    return Object.entries(persisted.hiddenAccounts).map(([accountId, hiddenAt]) => ({
      accountId,
      hidden: true,
      hiddenAt,
    }));
  }

  function hasPin() {
    return Boolean(persisted.pinHash && persisted.pinSalt);
  }

  function getLockRemainingMs() {
    if (!persisted.lockedUntil) {
      return 0;
    }
    return Math.max(0, persisted.lockedUntil - getNow());
  }

  async function verifyPin(pin: string) {
    if (!persisted.pinHash || !persisted.pinSalt) {
      return false;
    }
    const derived = await hashPin(pin, hexToBytes(persisted.pinSalt), iterations);
    return timingSafeEqual(derived, hexToBytes(persisted.pinHash));
  }

  async function hideChat(accountId: string, chatId: string) {
    if (!persisted.hiddenChats[accountId]) {
      persisted.hiddenChats[accountId] = {};
    }
    persisted.hiddenChats[accountId][chatId] = getNow();
    await persist();
    notify();
  }

  async function unhideChat(accountId: string, chatId: string) {
    const record = persisted.hiddenChats[accountId];
    if (!record || record[chatId] === undefined) {
      return;
    }
    delete record[chatId];
    if (!Object.keys(record).length) {
      delete persisted.hiddenChats[accountId];
    }
    await persist();
    notify();
  }

  async function hideAccount(accountId: string) {
    persisted.hiddenAccounts[accountId] = getNow();
    await persist();
    notify();
  }

  async function unhideAccount(accountId: string) {
    if (persisted.hiddenAccounts[accountId] === undefined) {
      return;
    }
    delete persisted.hiddenAccounts[accountId];
    await persist();
    notify();
  }

  async function unlockVault(pin: string) {
    if (getLockRemainingMs() > 0) {
      return false;
    }

    if (!hasPin()) {
      isUnlocked = true;
      lastActivityAt = getNow();
      scheduleAutoLock();
      notify();
      return true;
    }

    const isMatch = await verifyPin(pin);
    if (!isMatch) {
      persisted.failedAttempts += 1;
      if (persisted.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        const extra = persisted.failedAttempts - MAX_FAILED_ATTEMPTS;
        persisted.lockedUntil = getNow() + Math.min(MAX_LOCKOUT_MS, BASE_LOCKOUT_MS * (2 ** extra));
      }
      await persist();
      notify();
      return false;
    }

    persisted.failedAttempts = 0;
    persisted.lockedUntil = undefined;
    isUnlocked = true;
    lastActivityAt = getNow();
    await persist();
    scheduleAutoLock();
    notify();
    return true;
  }

  async function setPin(pin: string, currentPin?: string) {
    if (pin.length < MIN_PIN_LENGTH) {
      return false;
    }
    if (hasPin()) {
      if (!currentPin || !await verifyPin(currentPin)) {
        return false;
      }
    }

    const salt = crypto.getRandomValues(new Uint8Array(PIN_SALT_BYTES));
    const derived = await hashPin(pin, salt, iterations);
    persisted.pinHash = bytesToHex(derived);
    persisted.pinSalt = bytesToHex(salt);
    persisted.failedAttempts = 0;
    persisted.lockedUntil = undefined;
    isUnlocked = true;
    lastActivityAt = getNow();
    await persist();
    scheduleAutoLock();
    notify();
    return true;
  }

  async function removePin(currentPin: string) {
    if (!hasPin() || !await verifyPin(currentPin)) {
      return false;
    }
    persisted.pinHash = undefined;
    persisted.pinSalt = undefined;
    persisted.failedAttempts = 0;
    persisted.lockedUntil = undefined;
    await persist();
    notify();
    return true;
  }

  async function setAutoLockMs(autoLockMs: AutoLockMs) {
    persisted.autoLockMs = autoLockMs;
    await persist();
    scheduleAutoLock();
    notify();
  }

  async function setHideFromSearch(hideFromSearch: boolean) {
    persisted.hideFromSearch = hideFromSearch;
    await persist();
    notify();
  }

  async function setHideNotifications(hideNotifications: boolean) {
    persisted.hideNotifications = hideNotifications;
    await persist();
    notify();
  }

  async function setHideNotificationPreview(hideNotificationPreview: boolean) {
    persisted.hideNotificationPreview = hideNotificationPreview;
    await persist();
    notify();
  }

  async function setPanicHotkey(panicHotkey: string) {
    persisted.panicHotkey = panicHotkey;
    panicMatcher = getHotkeyMatcher(panicHotkey);
    await persist();
    notify();
  }

  function openVault() {
    isUiOpen = true;
    if (!hasPin()) {
      isUnlocked = true;
      lastActivityAt = getNow();
      scheduleAutoLock();
    }
    notify();
  }

  function closeVault() {
    isUiOpen = false;
    notify();
  }

  async function init() {
    if (isInited) return;
    isInited = true;

    try {
      const stored = await storage.get(PRIVACY_IDB_KEY);
      if (stored) {
        persisted = parsePersisted(stored);
      }
    } catch {
      // Keep snapshot-backed in-memory state
    }

    persistSyncSnapshot();
    panicMatcher = getHotkeyMatcher(persisted.panicHotkey);
    notify();

    if (options.noDom || typeof window !== 'object') {
      return;
    }

    window.addEventListener('keydown', handlePanicKey, true);
    window.addEventListener('pointerdown', noteActivity, true);
    window.addEventListener('keydown', noteActivity);
    document.addEventListener('visibilitychange', handleVisibility);

    try {
      lockChannel = new BroadcastChannel(LOCK_CHANNEL_NAME);
      lockChannel.addEventListener('message', (event: MessageEvent) => {
        if (event.data?.type === 'lock') {
          lockVault();
        }
      });
    } catch {
      lockChannel = undefined;
    }
  }

  return {
    init,
    subscribe: (cb: Listener) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    getRevision: () => revision,
    getCurrentAccountId: getAccountId,
    isVaultUnlocked: () => isUnlocked,
    isUiOpen: () => isUiOpen,
    hasPin,
    getLockRemainingMs,
    getPersisted: () => persisted,
    getHiddenChatIds: (accountId = getAccountId()) => getChatSet(accountId),
    getHiddenAccountIds: getAccountSet,
    isChatHidden: hasHiddenChat,
    isAccountHidden,
    getVisibleChats: listVisibleChats,
    filterHiddenChatIds,
    filterHiddenSearchResults: excludeHiddenSearchResults,
    filterHiddenPeerIds,
    shouldSuppressNotification,
    shouldHideNotificationPreview,
    shouldBlockOpenChat,
    getVisibleAccountIds,
    getHiddenChats,
    getHiddenAccounts,
    hideChat,
    unhideChat,
    hideAccount,
    unhideAccount,
    unlockVault,
    lockVault,
    triggerPanicLock,
    setPin,
    removePin,
    setAutoLockMs,
    setHideFromSearch,
    setHideNotifications,
    setHideNotificationPreview,
    setPanicHotkey,
    openVault,
    closeVault,
    noteActivity,
    checkAutoLock,
  };
}

export type PrivacyVault = ReturnType<typeof createPrivacyVault>;

export const privacyVault = createPrivacyVault();

export function isChatHidden(accountId: string, chatId: string) {
  return privacyVault.isChatHidden(accountId, chatId);
}

export function getVisibleChats<T extends { id: string }>(accountId: string, chats: T[]) {
  return privacyVault.getVisibleChats(accountId, chats);
}

export function filterHiddenSearchResults<T extends SearchResultKey>(results: T[]) {
  return privacyVault.filterHiddenSearchResults(results);
}
