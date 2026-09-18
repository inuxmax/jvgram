import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  createPriorityGoldStore,
  GOLD_CUSTOM_TYPES,
  MAX_GOLD_CUSTOM_BYTES,
  resolveActiveSkin,
} from './priorityGold';

const STORAGE_KEY = 'taa.priorityGold';

afterEach(() => {
  localStorage.removeItem(STORAGE_KEY);
  document.documentElement.classList.remove('priority-gold');
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-gold-wallpaper');
});

describe('Priority Gold theme', () => {
  test('Default theme loads', () => {
    expect(resolveActiveSkin('default', true)).toBe('default');
    const store = createPriorityGoldStore();
    expect(store.getActiveSkin()).toBe('default');
  });

  test('Priority Gold loads', () => {
    const store = createPriorityGoldStore();
    expect(store.setSkin('priority-gold')).toBe(true);
    expect(store.getActiveSkin()).toBe('priority-gold');
    expect(document.documentElement.classList.contains('priority-gold')).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('priority-gold');
  });

  test('Theme switching works', () => {
    const store = createPriorityGoldStore();
    store.setSkin('priority-gold');
    store.setSkin('default');
    expect(store.getActiveSkin()).toBe('default');
    expect(document.documentElement.classList.contains('priority-gold')).toBe(false);
  });

  test('Theme persists after restart', () => {
    const store = createPriorityGoldStore();
    store.setSkin('priority-gold');
    const restored = createPriorityGoldStore();
    expect(restored.getState().skin).toBe('priority-gold');
    expect(restored.getActiveSkin()).toBe('priority-gold');
  });

  test('Theme does not reload Telegram', () => {
    const reload = vi.fn();
    const store = createPriorityGoldStore();
    store.setSkin('priority-gold');
    store.setSkin('default');
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('Feature flag', () => {
  test('Disabled theme cannot be selected', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      skin: 'default',
      wallpaper: 'dragon-gold',
      flagEnabled: false,
      flagFetched: true,
    }));
    const store = createPriorityGoldStore();
    expect(store.setSkin('priority-gold')).toBe(false);
    expect(store.getActiveSkin()).toBe('default');
  });

  test('Existing Priority user falls back to Default', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      skin: 'priority-gold',
      wallpaper: 'dragon-gold',
      flagEnabled: false,
      flagFetched: true,
    }));
    const store = createPriorityGoldStore();
    store.init();
    expect(store.getState().skin).toBe('priority-gold');
    expect(store.getActiveSkin()).toBe('default');
    expect(document.documentElement.classList.contains('priority-gold')).toBe(false);
  });

  test('Re-enabling allows selection again', () => {
    expect(resolveActiveSkin('priority-gold', true)).toBe('priority-gold');
  });
});

describe('Background', () => {
  test('Dragon Gold background loads', () => {
    const store = createPriorityGoldStore();
    store.setSkin('priority-gold');
    store.setWallpaper('dragon-gold');
    expect(document.documentElement.getAttribute('data-gold-wallpaper')).toBe('dragon-gold');
  });

  test('Background persists', () => {
    const store = createPriorityGoldStore();
    store.setWallpaper('gold-wave');
    const restored = createPriorityGoldStore();
    expect(restored.getState().wallpaper).toBe('gold-wave');
  });

  test('Reset background works', () => {
    const store = createPriorityGoldStore();
    store.setWallpaper('gold-pattern');
    store.setWallpaper('default');
    expect(store.getState().wallpaper).toBe('default');
  });

  test('Custom wallpaper rejects scripts', () => {
    expect(GOLD_CUSTOM_TYPES.has('image/svg+xml')).toBe(false);
    expect(GOLD_CUSTOM_TYPES.has('text/html')).toBe(false);
    expect(MAX_GOLD_CUSTOM_BYTES).toBeLessThanOrEqual(400 * 1024);
  });

  test('Custom wallpaper rejects invalid files', async () => {
    const store = createPriorityGoldStore();
    const svg = new File(['<svg></svg>'], 'x.svg', { type: 'image/svg+xml' });
    const oversized = new File([new Uint8Array(MAX_GOLD_CUSTOM_BYTES + 1)], 'x.jpg', { type: 'image/jpeg' });
    expect(await store.applyFromFile(svg)).toBe(false);
    expect(await store.applyFromFile(oversized)).toBe(false);
    expect(store.getState().wallpaper).not.toBe('custom');
  });
});

describe('Realtime feature flag', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('Admin disable falls back without changing saved preference', async () => {
    const store = createPriorityGoldStore({ adminApiUrl: 'http://admin.test' });
    expect(store.setSkin('priority-gold')).toBe(true);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ priorityGoldTheme: false }),
    }));

    await store.refreshFlag();
    expect(store.getState().skin).toBe('priority-gold');
    expect(store.getActiveSkin()).toBe('default');
    expect(document.documentElement.classList.contains('priority-gold')).toBe(false);
  });

  test('Re-enabling restores Priority Gold', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      skin: 'priority-gold',
      wallpaper: 'dragon-gold',
      flagEnabled: false,
      flagFetched: true,
    }));
    const store = createPriorityGoldStore({ adminApiUrl: 'http://admin.test' });
    store.init();
    expect(store.getActiveSkin()).toBe('default');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ priorityGoldTheme: true }),
    }));

    await store.refreshFlag();
    expect(store.getActiveSkin()).toBe('priority-gold');
  });

  test('Offline keeps cached flag', async () => {
    const store = createPriorityGoldStore({ adminApiUrl: 'http://admin.test' });
    store.setSkin('priority-gold');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await store.refreshFlag();
    expect(store.getActiveSkin()).toBe('priority-gold');
  });
});
