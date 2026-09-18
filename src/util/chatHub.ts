import type { GlobalState } from '../global/types';
import { MAIN_THREAD_ID } from '../api/types';

import { GLOBAL_STATE_CACHE_PREFIX } from '../config';
import { MAIN_IDB_STORE } from './browser/idb';
import { ACCOUNT_SLOT, getAccountDisplayName, getAccountsInfo } from './multiaccount';
import { parseHotkey } from './parseHotkey';
import { privacyVault } from './privacyVault';

export const CHAT_HUB_STORAGE_KEY = 'taa.chathub';
export const DEFAULT_CHAT_HUB_HOTKEY = 'Ctrl+Shift+U';
export const CHAT_HUB_ROW_HEIGHT_PX = 72;
export const CHAT_HUB_COMPACT_ROW_HEIGHT_PX = 56;

export type ChatHubWorkspace = 'telegram' | 'chathub';
export type ChatHubViewMode = 'unified' | 'grouped';
export type ChatHubFilter =
  | 'all'
  | 'priority'
  | 'unread'
  | 'mentions'
  | 'pinned'
  | 'private'
  | 'groups'
  | 'channels'
  | 'bots';
export type UnifiedChatType = 'private' | 'group' | 'channel' | 'bot' | 'saved';

export type ChatHubSettings = {
  showAccountBadge: boolean;
  showAccountName: boolean;
  showUnreadCount: boolean;
  showFolders: boolean;
  showChannels: boolean;
  showBots: boolean;
  compactMode: boolean;
  viewMode: ChatHubViewMode;
  hotkey: string;
};

export type UnifiedChat = {
  key: string;
  accountId: string;
  chatId: string;
  title: string;
  type: UnifiedChatType;
  lastMessagePreview?: string;
  lastMessageDate: number;
  unreadCount: number;
  mentionCount: number;
  isPinned: boolean;
  isMuted: boolean;
  isLive: boolean;
  isConnecting?: boolean;
  usernames: string[];
  folderIds: number[];
  accountName: string;
  accountAvatarUri?: string;
  colorIndex: number;
};

export type UnifiedFolder = {
  key: string;
  accountId: string;
  folderId: number;
  title: string;
  accountName: string;
  includedChatIds: string[];
};

export type UnifiedAccount = {
  accountId: string;
  name: string;
  avatarUri?: string;
  isLive: boolean;
  isConnecting?: boolean;
  isOffline?: boolean;
};

export type ChatHubState = {
  workspace: ChatHubWorkspace;
  filter: ChatHubFilter;
  selectedAccountIds: string[];
  selectedFolderKey?: string;
  searchQuery: string;
  isSettingsOpen: boolean;
  settings: ChatHubSettings;
  priorityKeys: string[];
};

export type ChatHubGlobalSlice = {
  currentUserId?: string;
  connectionState?: string;
  chats?: {
    byId?: Record<string, {
      id: string;
      title?: string;
      type?: string;
      usernames?: Array<{ username?: string; isActive?: boolean }>;
      folderId?: number;
    }>;
    listIds?: { active?: string[] };
    orderedPinnedIds?: { active?: string[] };
    lastMessageIds?: { all?: Record<string, number> };
    notifyExceptionById?: Record<string, { mutedUntil?: number }>;
  };
  messages?: {
    byChatId?: Record<string, {
      byId?: Record<number, {
        date?: number;
        content?: { text?: { text?: string } };
      }>;
      threadsById?: Record<string | number, {
        readState?: {
          unreadCount?: number;
          unreadMentionsCount?: number;
          hasUnreadMark?: boolean;
        };
      }>;
    }>;
  };
  users?: {
    byId?: Record<string, {
      id: string;
      type?: string;
      firstName?: string;
      lastName?: string;
    }>;
  };
  chatFolders?: {
    orderedIds?: number[];
    byId?: Record<number, {
      id: number;
      title?: { text?: string };
      includedChatIds?: string[];
      pinnedChatIds?: string[];
    }>;
  };
};

export type ChatHubPrivacy = {
  isVaultUnlocked: boolean;
  hiddenAccountIds: Set<string>;
  hiddenChatsByAccount: Record<string, Set<string>>;
  revision?: number;
};

type Listener = NoneToVoidFunction;

type StoreOptions = {
  storage?: {
    getItem: (key: string) => string | undefined;
    setItem: (key: string, value: string) => void;
  };
};

export const DEFAULT_CHAT_HUB_SETTINGS: ChatHubSettings = {
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

const DEFAULT_STATE: ChatHubState = {
  workspace: 'telegram',
  filter: 'all',
  selectedAccountIds: [],
  searchQuery: '',
  isSettingsOpen: false,
  settings: DEFAULT_CHAT_HUB_SETTINGS,
  priorityKeys: [],
};

const FILTERS: ChatHubFilter[] = [
  'all', 'priority', 'unread', 'mentions', 'pinned', 'private', 'groups', 'channels', 'bots',
];

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function getCurrentChatHubAccountId() {
  return String(ACCOUNT_SLOT || 1);
}

export function buildUnifiedChatKey(accountId: string, chatId: string) {
  return `${accountId}:${chatId}`;
}

export function buildUnifiedFolderKey(accountId: string, folderId: number) {
  return `${accountId}:${folderId}`;
}

export function getGlobalStateCacheKeyForSlot(slot: number) {
  return slot === 1 ? GLOBAL_STATE_CACHE_PREFIX : `${GLOBAL_STATE_CACHE_PREFIX}_${slot}`;
}

export function isValidChatHubHotkey(value: string) {
  const parsed = parseHotkey(value);
  return Boolean(parsed.key);
}

function normalizeSettings(raw?: Record<string, unknown>): ChatHubSettings {
  const hotkey = asString(raw?.hotkey).trim() || DEFAULT_CHAT_HUB_HOTKEY;
  const viewMode = raw?.viewMode === 'grouped' ? 'grouped' : 'unified';

  return {
    showAccountBadge: asBoolean(raw?.showAccountBadge, true),
    showAccountName: asBoolean(raw?.showAccountName, true),
    showUnreadCount: asBoolean(raw?.showUnreadCount, true),
    showFolders: asBoolean(raw?.showFolders, true),
    showChannels: asBoolean(raw?.showChannels, true),
    showBots: asBoolean(raw?.showBots, true),
    compactMode: asBoolean(raw?.compactMode, false),
    viewMode,
    hotkey: isValidChatHubHotkey(hotkey) ? hotkey : DEFAULT_CHAT_HUB_HOTKEY,
  };
}

function readStored(storage: StoreOptions['storage']): Partial<ChatHubState> | undefined {
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(CHAT_HUB_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = asRecord(JSON.parse(raw) as unknown);
    if (!parsed) return undefined;
    const filter = FILTERS.includes(parsed.filter as ChatHubFilter)
      ? parsed.filter as ChatHubFilter
      : 'all';

    return {
      workspace: parsed.workspace === 'chathub' ? 'chathub' : 'telegram',
      filter,
      selectedAccountIds: asStringArray(parsed.selectedAccountIds),
      selectedFolderKey: asString(parsed.selectedFolderKey) || undefined,
      settings: normalizeSettings(asRecord(parsed.settings)),
      priorityKeys: asStringArray(parsed.priorityKeys),
    };
  } catch {
    return undefined;
  }
}

function resolveChatType(
  chatId: string,
  chatType: string | undefined,
  currentUserId: string | undefined,
  userType: string | undefined,
): UnifiedChatType {
  if (currentUserId && chatId === currentUserId) return 'saved';
  if (userType === 'userTypeBot') return 'bot';
  if (chatType === 'chatTypeChannel') return 'channel';
  if (chatType === 'chatTypeBasicGroup' || chatType === 'chatTypeSuperGroup') return 'group';
  return 'private';
}

function readThreadState(
  slice: ChatHubGlobalSlice,
  chatId: string,
) {
  const thread = slice.messages?.byChatId?.[chatId]?.threadsById?.[MAIN_THREAD_ID]
    || slice.messages?.byChatId?.[chatId]?.threadsById?.[String(MAIN_THREAD_ID)];
  return thread?.readState;
}

function readLastMessage(
  slice: ChatHubGlobalSlice,
  chatId: string,
) {
  const lastId = slice.chats?.lastMessageIds?.all?.[chatId];
  if (!lastId) return undefined;
  return slice.messages?.byChatId?.[chatId]?.byId?.[lastId];
}

function buildFolderIdsForChat(
  chatId: string,
  folders: UnifiedFolder[],
  fallbackFolderId?: number,
) {
  const ids = folders
    .filter((folder) => folder.includedChatIds.includes(chatId))
    .map((folder) => folder.folderId);
  if (fallbackFolderId && !ids.includes(fallbackFolderId)) {
    ids.push(fallbackFolderId);
  }
  return ids;
}

export function buildUnifiedFoldersFromGlobal(
  slice: ChatHubGlobalSlice,
  accountId: string,
  accountName: string,
): UnifiedFolder[] {
  const byId = slice.chatFolders?.byId || {};
  const orderedIds = slice.chatFolders?.orderedIds || Object.keys(byId).map(Number);

  return orderedIds.map((folderId) => {
    const folder = byId[folderId];
    if (!folder) return undefined;
    return {
      key: buildUnifiedFolderKey(accountId, folderId),
      accountId,
      folderId,
      title: folder.title?.text || `Folder ${folderId}`,
      accountName,
      includedChatIds: [
        ...(folder.includedChatIds || []),
        ...(folder.pinnedChatIds || []),
      ],
    } satisfies UnifiedFolder;
  }).filter((folder): folder is UnifiedFolder => Boolean(folder));
}

export function buildUnifiedChatsFromGlobal(options: {
  slice: ChatHubGlobalSlice;
  accountId: string;
  accountName: string;
  accountAvatarUri?: string;
  isLive: boolean;
  savedTitle: string;
}): UnifiedChat[] {
  const {
    slice, accountId, accountName, accountAvatarUri, isLive, savedTitle,
  } = options;
  const byId = slice.chats?.byId || {};
  const listIds = slice.chats?.listIds?.active || Object.keys(byId);
  const pinnedIds = new Set(slice.chats?.orderedPinnedIds?.active || []);
  const folders = buildUnifiedFoldersFromGlobal(slice, accountId, accountName);
  const isConnecting = isLive && slice.connectionState === 'connectionStateConnecting';
  const seen = new Set<string>();
  const chats: UnifiedChat[] = [];

  listIds.forEach((chatId) => {
    if (!chatId || seen.has(chatId)) return;
    seen.add(chatId);
    const chat = byId[chatId];
    if (!chat) return;

    const user = slice.users?.byId?.[chatId];
    const type = resolveChatType(chatId, chat.type, slice.currentUserId, user?.type);
    const lastMessage = readLastMessage(slice, chatId);
    const readState = readThreadState(slice, chatId);
    const usernames = (chat.usernames || [])
      .map((item) => item.username)
      .filter((name): name is string => Boolean(name));
    const title = type === 'saved'
      ? savedTitle
      : (chat.title || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || chatId);

    chats.push({
      key: buildUnifiedChatKey(accountId, chatId),
      accountId,
      chatId,
      title,
      type,
      lastMessagePreview: lastMessage?.content?.text?.text,
      lastMessageDate: lastMessage?.date || 0,
      unreadCount: (readState?.unreadCount || 0) + (readState?.hasUnreadMark ? 1 : 0),
      mentionCount: readState?.unreadMentionsCount || 0,
      isPinned: pinnedIds.has(chatId),
      isMuted: Boolean(slice.chats?.notifyExceptionById?.[chatId]?.mutedUntil),
      isLive,
      isConnecting,
      usernames,
      folderIds: buildFolderIdsForChat(chatId, folders, chat.folderId),
      accountName,
      accountAvatarUri,
      colorIndex: Math.abs(Number(chatId) || 0) % 7,
    });
  });

  return chats;
}

export function getChatHubPrivacySnapshot(): ChatHubPrivacy {
  return {
    isVaultUnlocked: privacyVault.isVaultUnlocked(),
    hiddenAccountIds: privacyVault.getHiddenAccountIds(),
    hiddenChatsByAccount: {},
  };
}

export function applyChatHubPrivacy(
  chats: UnifiedChat[],
  privacy: ChatHubPrivacy,
  getHiddenChatIds: (accountId: string) => Set<string> = (accountId) => (
    privacy.hiddenChatsByAccount[accountId] || new Set()
  ),
) {
  if (privacy.isVaultUnlocked) {
    return chats;
  }

  return chats.filter((chat) => {
    if (privacy.hiddenAccountIds.has(chat.accountId)) return false;
    return !getHiddenChatIds(chat.accountId).has(chat.chatId);
  });
}

export function applyChatHubAccountPrivacy(
  accounts: UnifiedAccount[],
  privacy: ChatHubPrivacy,
) {
  if (privacy.isVaultUnlocked) {
    return accounts;
  }
  return accounts.filter((account) => !privacy.hiddenAccountIds.has(account.accountId));
}

export function applyChatHubFolderPrivacy(
  folders: UnifiedFolder[],
  privacy: ChatHubPrivacy,
) {
  if (privacy.isVaultUnlocked) {
    return folders;
  }
  return folders.filter((folder) => !privacy.hiddenAccountIds.has(folder.accountId));
}

export function sortUnifiedChats(chats: UnifiedChat[]) {
  return [...chats].sort((left, right) => {
    if (right.lastMessageDate !== left.lastMessageDate) {
      return right.lastMessageDate - left.lastMessageDate;
    }
    return left.title.localeCompare(right.title);
  });
}

export function filterUnifiedChats(
  chats: UnifiedChat[],
  options: {
    filter: ChatHubFilter;
    selectedAccountIds: string[];
    selectedFolderKey?: string;
    searchQuery: string;
    settings: ChatHubSettings;
    priorityKeys: string[];
  },
) {
  const {
    filter, selectedAccountIds, selectedFolderKey, searchQuery, settings, priorityKeys,
  } = options;
  const query = searchQuery.trim().toLowerCase();
  const accountSet = selectedAccountIds.length ? new Set(selectedAccountIds) : undefined;
  const prioritySet = new Set(priorityKeys);

  return chats.filter((chat) => {
    if (accountSet && !accountSet.has(chat.accountId)) return false;
    if (selectedFolderKey) {
      const [folderAccountId, folderIdRaw] = selectedFolderKey.split(':');
      const folderId = Number(folderIdRaw);
      if (chat.accountId !== folderAccountId || !chat.folderIds.includes(folderId)) return false;
    }
    if (!settings.showChannels && chat.type === 'channel' && filter !== 'channels') return false;
    if (!settings.showBots && chat.type === 'bot' && filter !== 'bots') return false;

    if (filter === 'priority' && !prioritySet.has(chat.key)) return false;
    if (filter === 'unread' && chat.unreadCount < 1 && chat.mentionCount < 1) return false;
    if (filter === 'mentions' && chat.mentionCount < 1) return false;
    if (filter === 'pinned' && !chat.isPinned) return false;
    if (filter === 'private' && chat.type !== 'private' && chat.type !== 'saved') return false;
    if (filter === 'groups' && chat.type !== 'group') return false;
    if (filter === 'channels' && chat.type !== 'channel') return false;
    if (filter === 'bots' && chat.type !== 'bot') return false;

    if (query) {
      const haystack = [
        chat.title,
        chat.lastMessagePreview,
        chat.accountName,
        ...chat.usernames,
      ].join(' ').toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}

export function groupUnifiedChats(chats: UnifiedChat[]) {
  const groups: Array<{ accountId: string; accountName: string; chats: UnifiedChat[] }> = [];
  const indexByAccount = new Map<string, number>();

  chats.forEach((chat) => {
    const existing = indexByAccount.get(chat.accountId);
    if (existing !== undefined) {
      groups[existing].chats.push(chat);
      return;
    }
    indexByAccount.set(chat.accountId, groups.length);
    groups.push({
      accountId: chat.accountId,
      accountName: chat.accountName,
      chats: [chat],
    });
  });

  return groups;
}

export function listChatHubAccounts(): UnifiedAccount[] {
  const liveId = getCurrentChatHubAccountId();
  const info = getAccountsInfo();
  const slots = Object.keys(info).map(Number).sort((left, right) => left - right);

  if (!slots.length) {
    return [{
      accountId: liveId,
      name: `Account ${liveId}`,
      isLive: true,
    }];
  }

  return slots.map((slot) => {
    const account = info[slot];
    return {
      accountId: String(slot),
      name: getAccountDisplayName(account) || `Account ${slot}`,
      avatarUri: account.avatarUri,
      isLive: String(slot) === liveId,
    };
  });
}

export async function loadCachedGlobalForSlot(slot: number) {
  try {
    return await MAIN_IDB_STORE.get<GlobalState>(getGlobalStateCacheKeyForSlot(slot));
  } catch {
    return undefined;
  }
}

export function createChatHubStore(options: StoreOptions = {}) {
  const storage = options.storage || (typeof localStorage === 'object'
    ? {
      getItem: (key: string) => localStorage.getItem(key) || undefined,
      setItem: (key: string, value: string) => {
        localStorage.setItem(key, value);
      },
    }
    : undefined);
  const stored = readStored(storage);
  let state: ChatHubState = {
    ...DEFAULT_STATE,
    ...stored,
    settings: {
      ...DEFAULT_CHAT_HUB_SETTINGS,
      ...stored?.settings,
    },
    searchQuery: '',
    isSettingsOpen: false,
  };
  const listeners = new Set<Listener>();

  function persist() {
    if (!storage) return;
    storage.setItem(CHAT_HUB_STORAGE_KEY, JSON.stringify({
      workspace: state.workspace,
      filter: state.filter,
      selectedAccountIds: state.selectedAccountIds,
      selectedFolderKey: state.selectedFolderKey,
      settings: state.settings,
      priorityKeys: state.priorityKeys,
    }));
  }

  function setState(patch: Partial<ChatHubState>) {
    state = { ...state, ...patch };
    persist();
    listeners.forEach((listener) => listener());
  }

  return {
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getState() {
      return state;
    },
    openChatHub() {
      setState({ workspace: 'chathub' });
    },
    openTelegram() {
      setState({ workspace: 'telegram', isSettingsOpen: false, searchQuery: '' });
    },
    toggleWorkspace() {
      setState({
        workspace: state.workspace === 'chathub' ? 'telegram' : 'chathub',
        isSettingsOpen: false,
      });
    },
    setFilter(filter: ChatHubFilter) {
      setState({
        filter,
        selectedFolderKey: undefined,
      });
    },
    setSelectedAccountIds(selectedAccountIds: string[]) {
      setState({ selectedAccountIds });
    },
    toggleAccount(accountId: string) {
      const selected = new Set(state.selectedAccountIds);
      if (selected.has(accountId)) {
        selected.delete(accountId);
      } else {
        selected.add(accountId);
      }
      setState({ selectedAccountIds: [...selected] });
    },
    setSelectedFolderKey(selectedFolderKey?: string) {
      setState({
        selectedFolderKey,
        filter: 'all',
      });
    },
    setSearchQuery(searchQuery: string) {
      state = { ...state, searchQuery };
      listeners.forEach((listener) => listener());
    },
    openSettings() {
      setState({ isSettingsOpen: true });
    },
    closeSettings() {
      setState({ isSettingsOpen: false });
    },
    patchSettings(patch: Partial<ChatHubSettings>) {
      const panicHotkey = privacyVault.getPersisted().panicHotkey;
      const nextHotkey = patch.hotkey !== undefined
        ? (
          isValidChatHubHotkey(patch.hotkey) && patch.hotkey.trim() !== panicHotkey
            ? patch.hotkey.trim()
            : state.settings.hotkey
        )
        : state.settings.hotkey;
      setState({
        settings: {
          ...state.settings,
          ...patch,
          hotkey: nextHotkey,
        },
      });
    },
    togglePriority(key: string) {
      const next = state.priorityKeys.includes(key)
        ? state.priorityKeys.filter((item) => item !== key)
        : [...state.priorityKeys, key];
      setState({ priorityKeys: next });
    },
    isPriority(key: string) {
      return state.priorityKeys.includes(key);
    },
  };
}

export const chatHubStore = createChatHubStore();
export const ChatHubAggregator = {
  buildUnifiedChatKey,
  buildUnifiedFolderKey,
  buildUnifiedChatsFromGlobal,
  buildUnifiedFoldersFromGlobal,
  filterUnifiedChats,
  sortUnifiedChats,
  groupUnifiedChats,
  applyChatHubPrivacy,
};
