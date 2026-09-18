import { useEffect, useMemo, useState } from '../lib/teact/teact';
import { addCallback } from '../lib/teact/teactn';
import { getActions, getGlobal } from '../global';

import { MAIN_THREAD_ID } from '../api/types';

import { ALL_FOLDER_ID, MUTE_INDEFINITE_TIMESTAMP, UNMUTE_TIMESTAMP } from '../config';
import {
  applyChatHubAccountPrivacy,
  applyChatHubFolderPrivacy,
  applyChatHubPrivacy,
  buildUnifiedChatsFromGlobal,
  buildUnifiedFoldersFromGlobal,
  type ChatHubGlobalSlice,
  type ChatHubPrivacy,
  chatHubStore,
  filterUnifiedChats,
  getCurrentChatHubAccountId,
  listChatHubAccounts,
  loadCachedGlobalForSlot,
  sortUnifiedChats,
  type UnifiedChat,
} from '../util/chatHub';
import { addOrderedIdsCallback } from '../util/folderManager';
import { getAccountsInfo, getAccountSlotUrl } from '../util/multiaccount';
import { privacyVault } from '../util/privacyVault';
import { createLocationHash } from '../util/routing';
import useForceUpdate from './useForceUpdate';
import useLang from './useLang';
import useLastCallback from './useLastCallback';

function readChatHubPrivacy(revision: number): ChatHubPrivacy {
  return {
    isVaultUnlocked: privacyVault.isVaultUnlocked(),
    hiddenAccountIds: privacyVault.getHiddenAccountIds(),
    hiddenChatsByAccount: {},
    revision,
  };
}

export function useChatHubWorkspace() {
  const forceUpdate = useForceUpdate();
  useEffect(() => chatHubStore.subscribe(forceUpdate), [forceUpdate]);
  const state = chatHubStore.getState();

  return {
    workspace: state.workspace,
    settings: state.settings,
    toggleWorkspace: chatHubStore.toggleWorkspace,
    openChatHub: chatHubStore.openChatHub,
    openTelegram: chatHubStore.openTelegram,
  };
}

export default function useChatHub() {
  const lang = useLang();
  const forceUpdate = useForceUpdate();
  const [otherSlices, setOtherSlices] = useState<Record<string, ChatHubGlobalSlice>>({});
  const state = chatHubStore.getState();

  useEffect(() => chatHubStore.subscribe(forceUpdate), [forceUpdate]);
  useEffect(() => privacyVault.subscribe(forceUpdate), [forceUpdate]);
  useEffect(() => addOrderedIdsCallback(ALL_FOLDER_ID, forceUpdate), [forceUpdate]);
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
    if (state.workspace !== 'chathub') {
      return undefined;
    }

    let cancelled = false;
    const liveId = getCurrentChatHubAccountId();
    const slots = listChatHubAccounts()
      .map((account) => Number(account.accountId))
      .filter((slot) => String(slot) !== liveId);

    void Promise.all(slots.map(async (slot) => {
      const slice = await loadCachedGlobalForSlot(slot);
      return [String(slot), slice] as const;
    })).then((entries) => {
      if (cancelled) return;
      const next: Record<string, ChatHubGlobalSlice> = {};
      entries.forEach(([accountId, slice]) => {
        if (slice) {
          next[accountId] = slice;
        }
      });
      setOtherSlices(next);
    });

    return () => {
      cancelled = true;
    };
  }, [state.workspace]);

  const privacyRevision = privacyVault.getRevision();

  const accounts = useMemo(() => {
    const privacy = readChatHubPrivacy(privacyRevision);
    const global = getGlobal();
    return applyChatHubAccountPrivacy(listChatHubAccounts(), privacy).map((account) => ({
      ...account,
      isConnecting: account.isLive && (
        global.connectionState === 'connectionStateConnecting'
        || global.connectionState === 'connectionStateBroken'
      ),
      isOffline: !account.isLive && !otherSlices[account.accountId],
    }));
  }, [otherSlices, privacyRevision]);

  const folders = useMemo(() => {
    const privacy = readChatHubPrivacy(privacyRevision);
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
    return applyChatHubFolderPrivacy([...liveFolders, ...otherFolders], privacy);
  }, [accounts, otherSlices, privacyRevision]);

  const chats = useMemo(() => {
    const privacy = readChatHubPrivacy(privacyRevision);
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

    const visible = applyChatHubPrivacy(
      [...liveChats, ...otherChats],
      privacy,
      (accountId) => privacyVault.getHiddenChatIds(accountId),
    );

    return sortUnifiedChats(filterUnifiedChats(visible, {
      filter: state.filter,
      selectedAccountIds: state.selectedAccountIds,
      selectedFolderKey: state.selectedFolderKey,
      searchQuery: state.searchQuery,
      settings: state.settings,
      priorityKeys: state.priorityKeys,
    }));
  }, [
    accounts,
    lang,
    otherSlices,
    privacyRevision,
    state.filter,
    state.priorityKeys,
    state.searchQuery,
    state.selectedAccountIds,
    state.selectedFolderKey,
    state.settings,
  ]);

  const openChat = useLastCallback((chat: UnifiedChat) => {
    chatHubStore.openTelegram();
    const currentSlot = Number(getCurrentChatHubAccountId());
    const targetSlot = Number(chat.accountId);
    if (targetSlot === currentSlot) {
      getActions().openChat({ id: chat.chatId, shouldReplaceHistory: true });
      return;
    }

    const info = getAccountsInfo()[targetSlot];
    const url = new URL(getAccountSlotUrl(targetSlot, false, info?.isTest));
    url.hash = createLocationHash(chat.chatId, 'thread', MAIN_THREAD_ID);
    window.location.assign(url.toString());
  });

  const markRead = useLastCallback((chat: UnifiedChat) => {
    if (!chat.isLive) {
      openChat(chat);
      return;
    }
    getActions().markChatMessagesRead({ id: chat.chatId });
  });

  const toggleMuted = useLastCallback((chat: UnifiedChat) => {
    if (!chat.isLive) {
      openChat(chat);
      return;
    }
    getActions().updateChatMutedState({
      chatId: chat.chatId,
      mutedUntil: chat.isMuted ? UNMUTE_TIMESTAMP : MUTE_INDEFINITE_TIMESTAMP,
    });
  });

  const togglePinned = useLastCallback((chat: UnifiedChat) => {
    if (!chat.isLive) {
      openChat(chat);
      return;
    }
    getActions().toggleChatPinned({ id: chat.chatId, folderId: ALL_FOLDER_ID });
  });

  const toggleArchived = useLastCallback((chat: UnifiedChat) => {
    if (!chat.isLive) {
      openChat(chat);
      return;
    }
    getActions().toggleChatArchived({ id: chat.chatId });
  });

  const togglePriority = useLastCallback((chat: UnifiedChat) => {
    chatHubStore.togglePriority(chat.key);
  });

  const hideChat = useLastCallback((chat: UnifiedChat) => {
    if (privacyVault.hasPin() && !privacyVault.isVaultUnlocked()) {
      privacyVault.openVault();
      return;
    }
    void privacyVault.hideChat(chat.accountId, chat.chatId);
  });

  return {
    workspace: state.workspace,
    filter: state.filter,
    selectedAccountIds: state.selectedAccountIds,
    selectedFolderKey: state.selectedFolderKey,
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
    openChat,
    markRead,
    toggleMuted,
    togglePinned,
    toggleArchived,
    togglePriority,
    hideChat,
  };
}

export type ChatHubController = ReturnType<typeof useChatHub>;
