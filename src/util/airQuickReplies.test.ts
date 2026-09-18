import { afterEach, describe, expect, test } from 'vitest';

import {
  createAirQuickReplyStore,
  normalizeQuickReplyShortcut,
} from './airQuickReplies';

const STORAGE_KEY = 'taa.airQuickReplies';

afterEach(() => {
  localStorage.removeItem(STORAGE_KEY);
});

describe('Air quick replies', () => {
  test('Normalizes shortcuts', () => {
    expect(normalizeQuickReplyShortcut('/Hello!')).toBe('hello');
    expect(normalizeQuickReplyShortcut('  Pay_ment  ')).toBe('pay_ment');
  });

  test('Seeds default commands', () => {
    const store = createAirQuickReplyStore();
    expect(store.getReplies().map((item) => item.shortcut)).toEqual(['hello', 'payment', 'price']);
  });

  test('Adds a user command', () => {
    const store = createAirQuickReplyStore();
    expect(store.addReply({ shortcut: '/thanks', content: 'Cảm ơn bạn!' })).toBe(true);
    expect(store.getReplies().some((item) => item.shortcut === 'thanks')).toBe(true);
  });

  test('Rejects duplicate shortcuts', () => {
    const store = createAirQuickReplyStore();
    expect(store.addReply({ shortcut: 'hello', content: 'Hi' })).toBe(false);
  });

  test('Updates and removes a command', () => {
    const store = createAirQuickReplyStore();
    store.addReply({ shortcut: 'hours', content: 'Open 9-5' });
    const id = store.getReplies().find((item) => item.shortcut === 'hours')!.id;
    expect(store.updateReply(id, { shortcut: 'hours', content: 'Open 8-6' })).toBe(true);
    expect(store.getReplies().find((item) => item.id === id)?.content).toBe('Open 8-6');
    expect(store.removeReply(id)).toBe(true);
    expect(store.getReplies().some((item) => item.id === id)).toBe(false);
  });

  test('Persists user commands', () => {
    const store = createAirQuickReplyStore();
    store.addReply({ shortcut: 'bye', content: 'Tạm biệt' });
    const restored = createAirQuickReplyStore();
    expect(restored.getReplies().some((item) => item.shortcut === 'bye')).toBe(true);
  });
});
