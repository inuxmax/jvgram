import { afterEach, describe, expect, test } from 'vitest';

import {
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
  getGlobalStateCacheKeyForSlot,
  getGlobalStateCacheKeysForSlot,
  listChatHubAccountSlots,
  listChatHubThreadMessages,
  parseGlobalStateCacheSlot,
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
  localStorage.removeItem('account3');
  localStorage.removeItem('account4');
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
    expect(merged[0]?.isPinned).toBe(true);
    expect(merged[0]?.lastMessageDate).toBe(300);
  });

  test('Keeps pinned chats above newer unpinned chats', () => {
    const chats = chatsForAccount('1').map((chat) => (
      chat.chatId === '300' ? { ...chat, lastMessageDate: 1 } : chat
    ));
    const sorted = sortUnifiedChats(chats);
    expect(sorted[0]?.chatId).toBe('300');
    expect(sorted[0]?.isPinned).toBe(true);
    expect(sorted[1]?.isPinned).toBe(false);
    expect(sorted[1]?.lastMessageDate).toBe(250);
  });

  test('Drops duplicate chat keys', () => {
    const chats = [...chatsForAccount('1'), ...chatsForAccount('1')];
    const sorted = sortUnifiedChats(chats);
    const keys = sorted.map((chat) => chat.key);
    expect(new Set(keys).size).toBe(keys.length);
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

  test('Lists thread messages in date order', () => {
    const messages = listChatHubThreadMessages({
      2: { date: 20, isOutgoing: true, content: { text: { text: 'Later' } } },
      1: { date: 10, content: { text: { text: 'Earlier' } } },
    });

    expect(messages.map((message) => message.text)).toEqual(['Earlier', 'Later']);
    expect(messages[1].isOutgoing).toBe(true);
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
    expect(restored.getState().settings.viewMode).toBe('unified');
    expect(restored.getState().priorityKeys).toEqual(['1:200']);
    expect(memory.get(CHAT_HUB_STORAGE_KEY)).toBeTruthy();
  });

  test('Opening ChatHub shows chats from every account', () => {
    const store = createChatHubStore({ storage });
    store.setSelectedAccountIds(['1']);
    store.setSelectedFolderKey('1:10');
    store.openChatHub();
    expect(store.getState().selectedAccountIds).toEqual([]);
    expect(store.getState().selectedFolderKey).toBeUndefined();
  });

  test('Slot 1 and slot 2 use separate cache keys', () => {
    expect(getGlobalStateCacheKeyForSlot(1)).toBe('tt-global-state');
    expect(getGlobalStateCacheKeysForSlot(1)).toContain('tt-global-state');
    expect(getGlobalStateCacheKeyForSlot(2)).toBe('tt-global-state_2');
    expect(parseGlobalStateCacheSlot('tt-global-state')).toBe(1);
    expect(parseGlobalStateCacheSlot('tt-global-state_2')).toBe(2);
  });

  test('Lists every local session slot', () => {
    localStorage.setItem('account3', JSON.stringify({ dcId: 2, userId: '300' }));
    localStorage.setItem('account4', JSON.stringify({ userId: '400' }));
    const slots = listChatHubAccountSlots();
    expect(slots).toContain(3);
    expect(slots).toContain(4);
  });

  test('Includes archived and extra chat ids', () => {
    const chats = buildUnifiedChatsFromGlobal({
      slice: {
        ...buildSlice(),
        chats: {
          ...buildSlice().chats,
          listIds: {
            active: ['200'],
            archived: ['300'],
          },
        },
      },
      accountId: '1',
      accountName: 'Account 1',
      isLive: true,
      savedTitle: 'Saved Messages',
      extraChatIds: ['400'],
    });
    expect(chats.map((chat) => chat.chatId).sort()).toEqual(['200', '300', '400']);
  });

  test('Keeps empty hotkey as the default', () => {
    const store = createChatHubStore({ storage });
    store.patchSettings({ hotkey: '' });
    expect(store.getState().settings.hotkey).toBe(DEFAULT_CHAT_HUB_HOTKEY);
  });
});
