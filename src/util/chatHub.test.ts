import { afterEach, describe, expect, test } from 'vitest';

import {
  applyChatHubPrivacy,
  buildUnifiedChatKey,
  buildUnifiedChatsFromGlobal,
  buildUnifiedFolderKey,
  buildUnifiedFoldersFromGlobal,
  CHAT_HUB_STORAGE_KEY,
  type ChatHubGlobalSlice,
  type ChatHubSettings,
  createChatHubStore,
  DEFAULT_CHAT_HUB_HOTKEY,
  filterUnifiedChats,
  sortUnifiedChats,
  type UnifiedChat,
} from './chatHub';

const DEFAULT_SETTINGS: ChatHubSettings = {
  showAccountBadge: true,
  showAccountName: true,
  showUnreadCount: true,
  showFolders: true,
  showChannels: true,
  showBots: true,
  compactMode: false,
  viewMode: 'unified',
  hotkey: DEFAULT_CHAT_HUB_HOTKEY,
};

const memory = new Map<string, string>();
const storage = {
  getItem: (key: string) => memory.get(key),
  setItem: (key: string, value: string) => {
    memory.set(key, value);
  },
};

afterEach(() => {
  memory.clear();
});

function buildSlice(): ChatHubGlobalSlice {
  return {
    currentUserId: '100',
    connectionState: 'connectionStateReady',
    chats: {
      byId: {
        100: { id: '100', title: 'Me', type: 'chatTypePrivate' },
        200: { id: '200', title: 'Alice', type: 'chatTypePrivate', usernames: [{ username: 'alice' }] },
        300: { id: '300', title: 'Work Group', type: 'chatTypeSuperGroup' },
        400: { id: '400', title: 'News', type: 'chatTypeChannel' },
        500: { id: '500', title: 'Helper', type: 'chatTypePrivate' },
      },
      listIds: { active: ['200', '300', '400', '500', '100'] },
      orderedPinnedIds: { active: ['300'] },
      lastMessageIds: { all: { 200: 11, 300: 21, 400: 31, 500: 41 } },
      notifyExceptionById: { 400: { mutedUntil: 999999 } },
    },
    messages: {
      byChatId: {
        200: {
          byId: { 11: { date: 200, content: { text: { text: 'Hi from Alice' } } } },
          threadsById: { [-1]: { readState: { unreadCount: 2 } } },
        },
        300: {
          byId: { 21: { date: 300, content: { text: { text: 'Standup' } } } },
          threadsById: { [-1]: { readState: { unreadMentionsCount: 1 } } },
        },
        400: {
          byId: { 31: { date: 150, content: { text: { text: 'Announcement' } } } },
        },
        500: {
          byId: { 41: { date: 250, content: { text: { text: 'Need help?' } } } },
        },
      },
    },
    users: {
      byId: {
        100: { id: '100', type: 'userTypeRegular', firstName: 'Me' },
        200: { id: '200', type: 'userTypeRegular', firstName: 'Alice' },
        500: { id: '500', type: 'userTypeBot', firstName: 'Helper' },
      },
    },
    chatFolders: {
      orderedIds: [10],
      byId: {
        10: {
          id: 10,
          title: { text: 'Work' },
          includedChatIds: ['300'],
        },
      },
    },
  };
}

function chatsForAccount(accountId: string, slice = buildSlice()) {
  return buildUnifiedChatsFromGlobal({
    slice,
    accountId,
    accountName: `Account ${accountId}`,
    isLive: accountId === '1',
    savedTitle: 'Saved Messages',
  });
}

describe('ChatHub aggregator', () => {
  test('Uses accountId plus chatId as the unique key', () => {
    expect(buildUnifiedChatKey('1', '200')).toBe('1:200');
    expect(buildUnifiedFolderKey('2', 10)).toBe('2:10');

    const first = chatsForAccount('1');
    const second = chatsForAccount('2');
    const merged = [...first, ...second];
    const keys = merged.map((chat) => chat.key);

    expect(keys).toContain('1:200');
    expect(keys).toContain('2:200');
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('Sorts by latest activity across accounts', () => {
    const merged = sortUnifiedChats([...chatsForAccount('1'), ...chatsForAccount('2')]);
    expect(merged[0]?.chatId).toBe('300');
    expect(merged[0]?.lastMessageDate).toBe(300);
  });

  test('Classifies private, group, channel, bot, and saved chats', () => {
    const byId = Object.fromEntries(chatsForAccount('1').map((chat) => [chat.chatId, chat]));
    expect(byId[100]?.type).toBe('saved');
    expect(byId[200]?.type).toBe('private');
    expect(byId[300]?.type).toBe('group');
    expect(byId[400]?.type).toBe('channel');
    expect(byId[500]?.type).toBe('bot');
    expect(byId[300]?.isPinned).toBe(true);
    expect(byId[200]?.unreadCount).toBe(2);
    expect(byId[300]?.mentionCount).toBe(1);
  });

  test('Keeps folders scoped to an account', () => {
    const folders = [
      ...buildUnifiedFoldersFromGlobal(buildSlice(), '1', 'Account 1'),
      ...buildUnifiedFoldersFromGlobal(buildSlice(), '2', 'Account 2'),
    ];
    expect(folders.map((folder) => folder.key)).toEqual(['1:10', '2:10']);
  });

  test('Filters unread, mentions, pins, types, accounts, folders, and search', () => {
    const chats = chatsForAccount('1');
    const filter = (
      extras: Partial<Parameters<typeof filterUnifiedChats>[1]>,
      list: UnifiedChat[] = chats,
    ) => filterUnifiedChats(list, {
      filter: 'all',
      selectedAccountIds: [],
      searchQuery: '',
      settings: DEFAULT_SETTINGS,
      priorityKeys: ['1:200'],
      ...extras,
    });

    expect(filter({ filter: 'unread' }).map((chat) => chat.chatId)).toEqual(['200', '300']);
    expect(filter({ filter: 'mentions' }).map((chat) => chat.chatId)).toEqual(['300']);
    expect(filter({ filter: 'pinned' }).map((chat) => chat.chatId)).toEqual(['300']);
    expect(filter({ filter: 'groups' }).map((chat) => chat.chatId)).toEqual(['300']);
    expect(filter({ filter: 'channels' }).map((chat) => chat.chatId)).toEqual(['400']);
    expect(filter({ filter: 'bots' }).map((chat) => chat.chatId)).toEqual(['500']);
    expect(filter({ filter: 'priority' }).map((chat) => chat.chatId)).toEqual(['200']);
    expect(filter({ selectedAccountIds: ['9'] })).toEqual([]);
    expect(filter({ selectedFolderKey: '1:10' }).map((chat) => chat.chatId)).toEqual(['300']);
    expect(filter({ searchQuery: 'alice' }).map((chat) => chat.chatId)).toEqual(['200']);
    expect(filter({
      settings: { ...DEFAULT_SETTINGS, showChannels: false },
    }).some((chat) => chat.type === 'channel')).toBe(false);
  });

  test('Hides locked accounts and chats', () => {
    const chats = [...chatsForAccount('1'), ...chatsForAccount('3')];
    const visible = applyChatHubPrivacy(chats, {
      isVaultUnlocked: false,
      hiddenAccountIds: new Set(['3']),
      hiddenChatsByAccount: { 1: new Set(['200']) },
    }, (accountId) => (
      accountId === '1' ? new Set(['200']) : new Set()
    ));

    expect(visible.some((chat) => chat.accountId === '3')).toBe(false);
    expect(visible.some((chat) => chat.chatId === '200')).toBe(false);
    expect(visible.some((chat) => chat.chatId === '300')).toBe(true);
  });

  test('Shows hidden rows when the vault is unlocked', () => {
    const chats = chatsForAccount('3');
    const visible = applyChatHubPrivacy(chats, {
      isVaultUnlocked: true,
      hiddenAccountIds: new Set(['3']),
      hiddenChatsByAccount: {},
    });
    expect(visible).toHaveLength(chats.length);
  });
});

describe('ChatHub store', () => {
  test('Persists workspace, settings, and priority keys', () => {
    const store = createChatHubStore({ storage });
    store.openChatHub();
    store.patchSettings({ compactMode: true, viewMode: 'grouped' });
    store.togglePriority('1:200');

    const restored = createChatHubStore({ storage });
    expect(restored.getState().workspace).toBe('chathub');
    expect(restored.getState().settings.compactMode).toBe(true);
    expect(restored.getState().settings.viewMode).toBe('grouped');
    expect(restored.getState().priorityKeys).toEqual(['1:200']);
    expect(memory.get(CHAT_HUB_STORAGE_KEY)).toBeTruthy();
  });

  test('Rejects an invalid hotkey and keeps the default', () => {
    const store = createChatHubStore({ storage });
    store.patchSettings({ hotkey: '' });
    expect(store.getState().settings.hotkey).toBe(DEFAULT_CHAT_HUB_HOTKEY);
  });
});
