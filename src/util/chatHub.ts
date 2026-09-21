import type { GlobalState } from '../global/types';
import { MAIN_THREAD_ID } from '../api/types';

import { GLOBAL_STATE_CACHE_PREFIX, SESSION_ACCOUNT_PREFIX } from '../config';
import { MAIN_IDB_STORE } from './browser/idb';
import { unique, uniqueByField } from './iteratees';
import { ACCOUNT_SLOT, getAccountDisplayName, getAccountsInfo, getAccountSlotUrl } from './multiaccount';
import { parseHotkey } from './parseHotkey';
import { createLocationHash } from './routing';

export const CHAT_HUB_STORAGE_KEY = 'taa.chathub';
const WINDOW_WORKSPACE_KEY = `taa.chathub.windowWorkspace.${ACCOUNT_SLOT || 1}`;
const WINDOW_EMBED_KEY = `taa.chathub.embed.${ACCOUNT_SLOT || 1}`;
export const DEFAULT_CHAT_HUB_HOTKEY = 'Ctrl+Tab';
const LEGACY_CHAT_HUB_HOTKEY = 'Ctrl+Shift+U';
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
export type ChatHubMessageKind =
  | 'text'
  | 'photo'
  | 'video'
  | 'sticker'
  | 'document'
  | 'voice'
  | 'audio'
  | 'action'
  | 'other';

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
  avatarPhotoId?: string;
  emojiStatusId?: string;
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

export type ChatHubEmbeddedChat = {
  accountId: string;
  chatId: string;
};

export type ChatHubState = {
  workspace: ChatHubWorkspace;
  filter: ChatHubFilter;
  selectedAccountIds: string[];
  selectedFolderKey?: string;
  selectedChatKey?: string;
  embeddedChat?: ChatHubEmbeddedChat;
  searchQuery: string;
  isSettingsOpen: boolean;
  settings: ChatHubSettings;
  priorityKeys: string[];
};

export type ChatHubThreadMessage = {
  id: number;
  date: number;
  isOutgoing: boolean;
  kind: ChatHubMessageKind;
  text?: string;
};

type ChatHubCachedContent = {
  text?: { text?: string };
  photo?: unknown;
  video?: unknown;
  sticker?: unknown;
  document?: unknown;
  voice?: unknown;
  audio?: unknown;
  action?: unknown;
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
      avatarPhotoId?: string;
      emojiStatus?: { documentId?: string };
    }>;
    listIds?: { active?: string[]; archived?: string[]; saved?: string[] };
    orderedPinnedIds?: { active?: string[]; archived?: string[] };
    lastMessageIds?: { all?: Record<string, number> };
    notifyExceptionById?: Record<string, { mutedUntil?: number }>;
  };
  messages?: {
    byChatId?: Record<string, {
      byId?: Record<number, unknown>;
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
      avatarPhotoId?: string;
      emojiStatus?: { documentId?: string };
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
const MAX_THREAD_MESSAGES = 120;

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

export function buildChatHubAccountChatUrl(
  accountId: string,
  chatId: string,
  workspace: ChatHubWorkspace = 'telegram',
) {
  const slot = Number(accountId);
  const info = getAccountsInfo()[slot];
  const url = new URL(getAccountSlotUrl(slot, false, info?.isTest));
  url.searchParams.set('chat', chatId);
  url.searchParams.set('workspace', workspace);
  url.searchParams.set('embed', 'chathub');
  url.hash = createLocationHash(chatId, 'thread', MAIN_THREAD_ID);
  return url.toString();
}

export function buildUnifiedFolderKey(accountId: string, folderId: number) {
  return `${accountId}:${folderId}`;
}

export function getGlobalStateCacheKeyForSlot(slot: number) {
  return slot === 1 ? GLOBAL_STATE_CACHE_PREFIX : `${GLOBAL_STATE_CACHE_PREFIX}_${slot}`;
}

export function getGlobalStateCacheKeysForSlot(slot: number) {
  if (slot === 1) {
    return [GLOBAL_STATE_CACHE_PREFIX, `${GLOBAL_STATE_CACHE_PREFIX}_1`];
  }
  return [`${GLOBAL_STATE_CACHE_PREFIX}_${slot}`];
}

export function parseGlobalStateCacheSlot(key: string) {
  if (key === GLOBAL_STATE_CACHE_PREFIX) return 1;
  const prefix = `${GLOBAL_STATE_CACHE_PREFIX}_`;
  if (!key.startsWith(prefix)) return undefined;
  const rest = key.slice(prefix.length);
  if (!/^\d+$/.test(rest)) return undefined;
  return Number(rest);
}

export function isValidChatHubHotkey(value: string) {
  const parsed = parseHotkey(value);
  return Boolean(parsed.key);
}

function normalizeSettings(raw?: Record<string, unknown>): ChatHubSettings {
  const storedHotkey = asString(raw?.hotkey).trim();
  const hotkey = !storedHotkey || storedHotkey === LEGACY_CHAT_HUB_HOTKEY
    ? DEFAULT_CHAT_HUB_HOTKEY
    : storedHotkey;
  const viewMode: ChatHubViewMode = 'unified';

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

function readWindowEmbed() {
  if (typeof window === 'undefined') return false;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('embed') === 'chathub') {
      sessionStorage.setItem(WINDOW_EMBED_KEY, '1');
      url.searchParams.delete('embed');
      window.history.replaceState(undefined, '', `${url.pathname}${url.search}${url.hash}`);
      return true;
    }
    return sessionStorage.getItem(WINDOW_EMBED_KEY) === '1';
  } catch {
    return false;
  }
}

export const IS_CHAT_HUB_EMBED = readWindowEmbed();

if (IS_CHAT_HUB_EMBED && typeof document !== 'undefined') {
  document.documentElement.classList.add('chathub-embed');
}

function readWindowWorkspace(): ChatHubWorkspace | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const url = new URL(window.location.href);
    const requested = url.searchParams.get('workspace');
    if (requested === 'telegram' || requested === 'chathub') {
      sessionStorage.setItem(WINDOW_WORKSPACE_KEY, requested);
      url.searchParams.delete('workspace');
      window.history.replaceState(undefined, '', `${url.pathname}${url.search}${url.hash}`);
      return requested;
    }
    const stored = sessionStorage.getItem(WINDOW_WORKSPACE_KEY);
    if (stored === 'telegram' || stored === 'chathub') return stored;
  } catch {
    return undefined;
  }
  return undefined;
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

function readAvatarPhotoId(chatAvatarPhotoId: unknown, userAvatarPhotoId: unknown) {
  if (typeof chatAvatarPhotoId === 'string' && chatAvatarPhotoId) return chatAvatarPhotoId;
  if (typeof userAvatarPhotoId === 'string' && userAvatarPhotoId) return userAvatarPhotoId;
  return undefined;
}

function readEmojiStatusId(...values: unknown[]) {
  for (const value of values) {
    const documentId = asString(asRecord(value)?.documentId).trim();
    if (documentId) return documentId;
  }
  return undefined;
}

function readThreadState(
  slice: ChatHubGlobalSlice,
  chatId: string,
) {
  const thread = slice.messages?.byChatId?.[chatId]?.threadsById?.[MAIN_THREAD_ID]
    || slice.messages?.byChatId?.[chatId]?.threadsById?.[String(MAIN_THREAD_ID)];
  return thread?.readState;
}

function parseCachedMessage(raw: unknown) {
  const record = asRecord(raw);
  if (!record) return undefined;
  const content = asRecord(record.content);
  const text = asRecord(content?.text);
  return {
    date: typeof record.date === 'number' ? record.date : undefined,
    isOutgoing: Boolean(record.isOutgoing),
    content: {
      text: typeof text?.text === 'string' ? { text: text.text } : undefined,
      photo: content?.photo,
      video: content?.video,
      sticker: content?.sticker,
      document: content?.document,
      voice: content?.voice,
      audio: content?.audio,
      action: content?.action,
    } satisfies ChatHubCachedContent,
  };
}

function readLastMessage(
  slice: ChatHubGlobalSlice,
  chatId: string,
) {
  const lastId = slice.chats?.lastMessageIds?.all?.[chatId];
  if (!lastId) return undefined;
  return parseCachedMessage(slice.messages?.byChatId?.[chatId]?.byId?.[lastId]);
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
  extraChatIds?: string[];
}): UnifiedChat[] {
  const {
    slice, accountId, accountName, accountAvatarUri, isLive, savedTitle, extraChatIds,
  } = options;
  const byId = slice.chats?.byId || {};
  const listedIds = unique([
    ...(extraChatIds || []),
    ...(slice.chats?.listIds?.active || []),
    ...(slice.chats?.listIds?.archived || []),
  ].map(String).filter(Boolean));
  const listIds = listedIds.length ? listedIds : Object.keys(byId).map(String);
  const pinnedIds = new Set([
    ...(slice.chats?.orderedPinnedIds?.active || []),
    ...(slice.chats?.orderedPinnedIds?.archived || []),
  ]);
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
      avatarPhotoId: readAvatarPhotoId(chat.avatarPhotoId, user?.avatarPhotoId),
      emojiStatusId: readEmojiStatusId(user?.emojiStatus, chat.emojiStatus),
      colorIndex: Math.abs(Number(chatId) || 0) % 7,
    });
  });

  return chats;
}

function resolveChatHubMessageKind(content?: ChatHubCachedContent): ChatHubMessageKind {
  if (content?.text?.text) return 'text';
  if (content?.photo) return 'photo';
  if (content?.video) return 'video';
  if (content?.sticker) return 'sticker';
  if (content?.document) return 'document';
  if (content?.voice) return 'voice';
  if (content?.audio) return 'audio';
  if (content?.action) return 'action';
  return 'other';
}

export function listChatHubThreadMessagesForChat(
  slice: ChatHubGlobalSlice | undefined,
  chatId: string,
) {
  return listChatHubThreadMessages(slice?.messages?.byChatId?.[chatId]?.byId);
}

export function listChatHubThreadMessages(
  byId?: object,
): ChatHubThreadMessage[] {
  if (!byId) return [];

  const messages = Object.entries(byId).map(([id, raw]) => {
    const message = parseCachedMessage(raw);
    const kind = resolveChatHubMessageKind(message?.content);
    return {
      id: Number(id),
      date: message?.date || 0,
      isOutgoing: Boolean(message?.isOutgoing),
      kind,
      text: message?.content?.text?.text,
    } satisfies ChatHubThreadMessage;
  }).sort((left, right) => {
    if (left.date !== right.date) return left.date - right.date;
    return left.id - right.id;
  });

  return messages.length > MAX_THREAD_MESSAGES
    ? messages.slice(messages.length - MAX_THREAD_MESSAGES)
    : messages;
}

export function sortUnifiedChats(chats: UnifiedChat[]) {
  return uniqueByField([...chats].sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return left.isPinned ? -1 : 1;
    }
    if (right.lastMessageDate !== left.lastMessageDate) {
      return right.lastMessageDate - left.lastMessageDate;
    }
    return left.title.localeCompare(right.title);
  }), 'key');
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

const ACCOUNT_SLOT_KEY = new RegExp(`^${SESSION_ACCOUNT_PREFIX}(\\d+)$`);

function readChatHubSessionSlot(slot: number) {
  try {
    const raw = localStorage.getItem(`${SESSION_ACCOUNT_PREFIX}${slot}`);
    if (!raw) return undefined;
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (data.dcId || data.userId) return data;
    return undefined;
  } catch {
    return undefined;
  }
}

export function listChatHubAccountSlots() {
  const liveSlot = Number(getCurrentChatHubAccountId());
  const slots = new Set<number>([liveSlot]);

  if (typeof localStorage === 'object') {
    Object.keys(localStorage).forEach((key) => {
      const match = key.match(ACCOUNT_SLOT_KEY);
      if (!match) return;
      const slot = Number(match[1]);
      if (!slot || Number.isNaN(slot)) return;
      if (readChatHubSessionSlot(slot)) {
        slots.add(slot);
      }
    });
  }

  Object.keys(getAccountsInfo()).forEach((accountId) => {
    const slot = Number(accountId);
    if (slot) slots.add(slot);
  });

  return [...slots].sort((left, right) => left - right);
}

export function listChatHubAccounts(): UnifiedAccount[] {
  const liveId = getCurrentChatHubAccountId();
  const info = getAccountsInfo();
  const slots = listChatHubAccountSlots();

  return slots.map((slot) => {
    const account = info[slot];
    return {
      accountId: String(slot),
      name: (account && getAccountDisplayName(account)) || `Account ${slot}`,
      avatarUri: account?.avatarUri,
      isLive: String(slot) === liveId,
    };
  });
}

function readLocalStorageGlobal(slot: number) {
  if (typeof localStorage !== 'object') return undefined;
  try {
    for (const key of getGlobalStateCacheKeysForSlot(slot)) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as GlobalState;
      if (parsed?.chats) return parsed;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export async function loadCachedGlobalForSlot(slot: number) {
  try {
    const keys = getGlobalStateCacheKeysForSlot(slot);
    for (const key of keys) {
      const slice = await MAIN_IDB_STORE.get<GlobalState>(key);
      if (slice) return slice;
    }
  } catch {
    // Fall through to localStorage snapshots
  }
  return readLocalStorageGlobal(slot);
}

export async function loadOtherAccountSlices(liveId: string) {
  const slots = new Set(listChatHubAccountSlots());

  try {
    const keys = await MAIN_IDB_STORE.keys();
    keys.forEach((key) => {
      if (typeof key !== 'string') return;
      const slot = parseGlobalStateCacheSlot(key);
      if (slot) slots.add(slot);
    });
  } catch {
    // Session slots still load when IndexedDB listing is unavailable
  }

  const next: Record<string, ChatHubGlobalSlice> = {};
  await Promise.all([...slots].map(async (slot) => {
    if (String(slot) === liveId) return;
    const slice = await loadCachedGlobalForSlot(slot);
    if (slice) {
      next[String(slot)] = slice;
    }
  }));
  return next;
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
  const windowWorkspace = readWindowWorkspace();
  const persistedWorkspace = stored?.workspace || DEFAULT_STATE.workspace;
  let state: ChatHubState = {
    ...DEFAULT_STATE,
    ...stored,
    selectedAccountIds: [],
    selectedFolderKey: undefined,
    workspace: windowWorkspace || persistedWorkspace,
    settings: {
      ...DEFAULT_CHAT_HUB_SETTINGS,
      ...stored?.settings,
      viewMode: 'unified',
    },
    searchQuery: '',
    isSettingsOpen: false,
  };
  const listeners = new Set<Listener>();

  function persist() {
    if (!storage) return;
    if (windowWorkspace) {
      try {
        sessionStorage.setItem(WINDOW_WORKSPACE_KEY, state.workspace);
      } catch {
        // Session storage can be unavailable in private mode
      }
    }
    storage.setItem(CHAT_HUB_STORAGE_KEY, JSON.stringify({
      workspace: windowWorkspace ? persistedWorkspace : state.workspace,
      filter: state.filter,
      selectedAccountIds: state.selectedAccountIds,
      selectedFolderKey: state.selectedFolderKey,
      settings: state.settings,
      priorityKeys: state.priorityKeys,
    }));
  }

  if (storage?.getItem(CHAT_HUB_STORAGE_KEY)?.includes(`"hotkey":"${LEGACY_CHAT_HUB_HOTKEY}"`)) {
    persist();
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
      setState({
        workspace: 'chathub',
        selectedAccountIds: [],
        selectedFolderKey: undefined,
      });
    },
    openTelegram() {
      setState({ workspace: 'telegram', isSettingsOpen: false, searchQuery: '' });
    },
    toggleWorkspace() {
      const isOpeningChatHub = state.workspace !== 'chathub';
      setState({
        workspace: isOpeningChatHub ? 'chathub' : 'telegram',
        isSettingsOpen: false,
        selectedAccountIds: isOpeningChatHub ? [] : state.selectedAccountIds,
        selectedFolderKey: isOpeningChatHub ? undefined : state.selectedFolderKey,
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
      const nextHotkey = patch.hotkey !== undefined
        ? (
          isValidChatHubHotkey(patch.hotkey)
            ? patch.hotkey.trim()
            : state.settings.hotkey
        )
        : state.settings.hotkey;
      setState({
        settings: {
          ...state.settings,
          ...patch,
          hotkey: nextHotkey,
          viewMode: 'unified',
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
    selectChat(selectedChatKey?: string) {
      setState({
        selectedChatKey,
        embeddedChat: selectedChatKey ? state.embeddedChat : undefined,
      });
    },
    openHubChat(selectedChatKey: string, embeddedChat?: ChatHubEmbeddedChat) {
      setState({ selectedChatKey, embeddedChat });
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
  listChatHubThreadMessages,
  listChatHubThreadMessagesForChat,
};
