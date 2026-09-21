import { useEffect, useMemo, useState } from '../lib/teact/teact';
import { addCallback } from '../lib/teact/teactn';
import { getActions, getGlobal } from '../global';

import { MAIN_THREAD_ID } from '../api/types';
import { LoadMoreDirection } from '../types';

import {
  ALL_FOLDER_ID,
  ARCHIVED_FOLDER_ID,
  MUTE_INDEFINITE_TIMESTAMP,
  SESSION_ACCOUNT_PREFIX,
  UNMUTE_TIMESTAMP,
} from '../config';
import {
  buildUnifiedChatKey,
  buildUnifiedChatsFromGlobal,
  buildUnifiedFoldersFromGlobal,
  type ChatHubGlobalSlice,
  chatHubStore,
  filterUnifiedChats,
  getCurrentChatHubAccountId,
  listChatHubAccounts,
  loadOtherAccountSlices,
  sortUnifiedChats,
  type UnifiedChat,
} from '../util/chatHub';
import { addOrderedIdsCallback, getOrderedIds } from '../util/folderManager';
import { unique } from '../util/iteratees';
import { ACCOUNTS_CHANGE_EVENT } from '../util/multiaccount';
import useInterval from './schedulers/useInterval';
import useForceUpdate from './useForceUpdate';
import useLang from './useLang';
import useLastCallback from './useLastCallback';

const OTHER_ACCOUNT_REFRESH_MS = 30000;

export function useChatHubWorkspace() {
  const forceUpdate = useForceUpdate();
  useEffect(() => chatHubStore.subscribe(forceUpdate), [forceUpdate]);
  const state = chatHubStore.getState();

  return {
    workspace: state.workspace,
    settings: state.settings,
    embeddedChat: state.embeddedChat,
    toggleWorkspace: chatHubStore.toggleWorkspace,
    openChatHub: chatHubStore.openChatHub,
    openTelegram: chatHubStore.openTelegram,
  };
}

export default function useChatHub() {
  const lang = useLang();
  const forceUpdate = useForceUpdate();
  const [otherSlices, setOtherSlices] = useState<Record<string, ChatHubGlobalSlice>>({});
  const [sessionAccounts, setSessionAccounts] = useState(listChatHubAccounts);
  const state = chatHubStore.getState();
  const isChatHubOpen = state.workspace === 'chathub';
  const connectionState = getGlobal().connectionState;
  const liveOrderedIds = getOrderedIds(ALL_FOLDER_ID);
  const archivedOrderedIds = getOrderedIds(ARCHIVED_FOLDER_ID);

  const reloadOtherSlices = useLastCallback(() => {
    const liveId = getCurrentChatHubAccountId();
    void loadOtherAccountSlices(liveId).then(setOtherSlices);
  });

  const bumpAccounts = useLastCallback(() => {
    setSessionAccounts(listChatHubAccounts());
    reloadOtherSlices();
  });

  useEffect(() => chatHubStore.subscribe(forceUpdate), [forceUpdate]);
  useEffect(() => {
    const unsubAll = addOrderedIdsCallback(ALL_FOLDER_ID, forceUpdate);
    const unsubArchived = addOrderedIdsCallback(ARCHIVED_FOLDER_ID, forceUpdate);
    return () => {
      unsubAll();
      unsubArchived();
    };
  }, [forceUpdate]);
  useEffect(() => {
    let frame: number | undefined;
    const handleUpdate = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        forceUpdate();
      });
    };
    return addCallback(handleUpdate);
  }, [forceUpdate]);

  useEffect(() => {
    if (!isChatHubOpen) {
      return undefined;
    }

    bumpAccounts();

    const handleStorage = (e: StorageEvent) => {
      if (e.key && !e.key.startsWith(SESSION_ACCOUNT_PREFIX)) return;
      bumpAccounts();
    };

    window.addEventListener(ACCOUNTS_CHANGE_EVENT, bumpAccounts);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(ACCOUNTS_CHANGE_EVENT, bumpAccounts);
      window.removeEventListener('storage', handleStorage);
    };
  }, [bumpAccounts, isChatHubOpen]);

  useInterval(() => {
    if (document.hidden) return;
    bumpAccounts();
  }, isChatHubOpen ? OTHER_ACCOUNT_REFRESH_MS : undefined, true);

  const accounts = useMemo(() => {
    const liveId = getCurrentChatHubAccountId();
    const byId = new Map(sessionAccounts.map((account) => [account.accountId, account]));

    Object.keys(otherSlices).forEach((accountId) => {
      if (byId.has(accountId)) return;
      byId.set(accountId, {
        accountId,
        name: `Account ${accountId}`,
        isLive: accountId === liveId,
      });
    });

    return [...byId.values()]
      .sort((left, right) => Number(left.accountId) - Number(right.accountId))
      .map((account) => ({
        ...account,
        isConnecting: account.isLive && (
          connectionState === 'connectionStateConnecting'
          || connectionState === 'connectionStateBroken'
        ),
        isOffline: !account.isLive && !otherSlices[account.accountId],
      }));
  }, [connectionState, otherSlices, sessionAccounts]);

  const folders = useMemo(() => {
    const liveId = getCurrentChatHubAccountId();
    const liveAccount = accounts.find((account) => account.accountId === liveId);
    const liveFolders = liveAccount
      ? buildUnifiedFoldersFromGlobal(getGlobal(), liveId, liveAccount.name)
      : [];
    const otherFolders = accounts.flatMap((account) => {
      if (account.isLive) return [];
      const slice = otherSlices[account.accountId];
      if (!slice) return [];
      return buildUnifiedFoldersFromGlobal(slice, account.accountId, account.name);
    });
    return [...liveFolders, ...otherFolders];
  }, [accounts, otherSlices]);

  const allChats = useMemo(() => {
    const liveId = getCurrentChatHubAccountId();
    const savedTitle = lang('SavedMessages');
    const liveAccount = accounts.find((account) => account.accountId === liveId);
    const liveChats = liveAccount
      ? buildUnifiedChatsFromGlobal({
        slice: getGlobal(),
        accountId: liveId,
        accountName: liveAccount.name,
        accountAvatarUri: liveAccount.avatarUri,
        isLive: true,
        savedTitle,
        extraChatIds: unique([
          ...(liveOrderedIds || []),
          ...(archivedOrderedIds || []),
        ]),
      })
      : [];
    const otherChats = accounts.flatMap((account) => {
      if (account.isLive) return [];
      const slice = otherSlices[account.accountId];
      if (!slice) return [];
      return buildUnifiedChatsFromGlobal({
        slice,
        accountId: account.accountId,
        accountName: account.name,
        accountAvatarUri: account.avatarUri,
        isLive: false,
        savedTitle,
      });
    });

    return sortUnifiedChats([...liveChats, ...otherChats]);
  }, [accounts, archivedOrderedIds, lang, liveOrderedIds, otherSlices]);

  const chats = useMemo(() => {
    return filterUnifiedChats(allChats, {
      filter: state.filter,
      selectedAccountIds: state.selectedAccountIds,
      selectedFolderKey: state.selectedFolderKey,
      searchQuery: state.searchQuery,
      settings: state.settings,
      priorityKeys: state.priorityKeys,
    });
  }, [
    allChats,
    state.filter,
    state.priorityKeys,
    state.searchQuery,
    state.selectedAccountIds,
    state.selectedFolderKey,
    state.settings,
  ]);

  const selectedChat = allChats.find((chat) => chat.key === state.selectedChatKey);

  const openLiveChat = useLastCallback((chatId: string) => {
    const { openChat, openForumPanel, loadViewportMessages } = getActions();
    const liveChat = getGlobal().chats.byId[chatId];
    if (liveChat?.isForum && !liveChat.isForumAsMessages) {
      openForumPanel({ chatId });
      return;
    }
    openChat({ id: chatId, shouldReplaceHistory: true });
    loadViewportMessages({
      chatId,
      threadId: MAIN_THREAD_ID,
      direction: LoadMoreDirection.Around,
    });
  });

  const openLivePeer = useLastCallback((chat: UnifiedChat) => {
    const liveKey = buildUnifiedChatKey(getCurrentChatHubAccountId(), chat.chatId);
    chatHubStore.openHubChat(liveKey);
    openLiveChat(chat.chatId);
  });

  const openEmbeddedChat = useLastCallback((chat: UnifiedChat) => {
    chatHubStore.openHubChat(chat.key, {
      accountId: chat.accountId,
      chatId: chat.chatId,
    });
  });

  const openInTelegram = useLastCallback((chat: UnifiedChat) => {
    if (chat.isLive) {
      chatHubStore.openHubChat(chat.key);
      chatHubStore.openTelegram();
      openLiveChat(chat.chatId);
      return;
    }

    openEmbeddedChat(chat);
  });

  const selectChat = useLastCallback((chat: UnifiedChat, shouldOpen?: boolean) => {
    if (shouldOpen === false) {
      chatHubStore.openHubChat(chat.key);
      return;
    }

    const liveChat = !chat.isLive ? getGlobal().chats.byId[chat.chatId] : undefined;
    if (liveChat && (chat.type === 'group' || chat.type === 'channel')) {
      openLivePeer(chat);
      return;
    }

    if (!chat.isLive) {
      openEmbeddedChat(chat);
      return;
    }

    chatHubStore.openHubChat(chat.key);
    openLiveChat(chat.chatId);
  });

  const closeChat = useLastCallback(() => {
    chatHubStore.selectChat(undefined);
  });

  const markRead = useLastCallback((chat: UnifiedChat) => {
    if (!chat.isLive) return;
    getActions().markChatMessagesRead({ id: chat.chatId });
  });

  const toggleMuted = useLastCallback((chat: UnifiedChat) => {
    if (!chat.isLive) return;
    getActions().updateChatMutedState({
      chatId: chat.chatId,
      mutedUntil: chat.isMuted ? UNMUTE_TIMESTAMP : MUTE_INDEFINITE_TIMESTAMP,
    });
  });

  const togglePinned = useLastCallback((chat: UnifiedChat) => {
    if (!chat.isLive) return;
    getActions().toggleChatPinned({ id: chat.chatId, folderId: ALL_FOLDER_ID });
  });

  const toggleArchived = useLastCallback((chat: UnifiedChat) => {
    if (!chat.isLive) return;
    getActions().toggleChatArchived({ id: chat.chatId });
  });

  const togglePriority = useLastCallback((chat: UnifiedChat) => {
    chatHubStore.togglePriority(chat.key);
  });

  return {
    workspace: state.workspace,
    filter: state.filter,
    selectedAccountIds: state.selectedAccountIds,
    selectedFolderKey: state.selectedFolderKey,
    selectedChatKey: state.selectedChatKey,
    selectedChat,
    searchQuery: state.searchQuery,
    isSettingsOpen: state.isSettingsOpen,
    settings: state.settings,
    priorityKeys: state.priorityKeys,
    accounts,
    folders,
    chats,
    openChatHub: chatHubStore.openChatHub,
    openTelegram: chatHubStore.openTelegram,
    toggleWorkspace: chatHubStore.toggleWorkspace,
    setFilter: chatHubStore.setFilter,
    toggleAccount: chatHubStore.toggleAccount,
    setSelectedAccountIds: chatHubStore.setSelectedAccountIds,
    setSelectedFolderKey: chatHubStore.setSelectedFolderKey,
    setSearchQuery: chatHubStore.setSearchQuery,
    openSettings: chatHubStore.openSettings,
    closeSettings: chatHubStore.closeSettings,
    patchSettings: chatHubStore.patchSettings,
    selectChat,
    closeChat,
    openInTelegram,
    markRead,
    toggleMuted,
    togglePinned,
    toggleArchived,
    togglePriority,
  };
}

export type ChatHubController = ReturnType<typeof useChatHub>;
