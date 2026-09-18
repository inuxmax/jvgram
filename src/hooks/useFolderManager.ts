import { useEffect } from '../lib/teact/teact';

import {
  addChatsCountCallback,
  addOrderedIdsCallback, addUnreadChatsByFolderIdCallback,
  addUnreadCountersCallback,
  getChatsCount,
  getOrderedIds, getUnreadChatsByFolderId,
  getUnreadCounters,
} from '../util/folderManager';
import { privacyVault } from '../util/privacyVault';
import useForceUpdate from './useForceUpdate';

export function useFolderManagerForOrderedIds(folderId: number) {
  const forceUpdate = useForceUpdate();

  useEffect(() => addOrderedIdsCallback(folderId, forceUpdate), [folderId, forceUpdate]);
  useEffect(() => privacyVault.subscribe(forceUpdate), [forceUpdate]);

  return privacyVault.filterHiddenChatIds(
    privacyVault.getCurrentAccountId(),
    getOrderedIds(folderId),
  );
}

export function useFolderManagerForUnreadCounters() {
  const forceUpdate = useForceUpdate();

  useEffect(() => addUnreadCountersCallback(forceUpdate), [forceUpdate]);
  useEffect(() => privacyVault.subscribe(forceUpdate), [forceUpdate]);

  const counters = getUnreadCounters();
  const hiddenIds = privacyVault.getHiddenChatIds();
  if (!hiddenIds.size) {
    return counters;
  }

  const unreadByFolder = getUnreadChatsByFolderId();
  const accountId = privacyVault.getCurrentAccountId();
  const next = { ...counters };

  Object.keys(counters).forEach((folderId) => {
    const original = counters[folderId];
    const ids = unreadByFolder[folderId];
    if (!original || !ids?.length) {
      return;
    }
    const visibleIds = privacyVault.filterHiddenChatIds(accountId, ids);
    if (!visibleIds || visibleIds.length === ids.length) {
      return;
    }
    next[folderId] = {
      chatsCount: visibleIds.length,
      notificationsCount: visibleIds.length ? original.notificationsCount : 0,
    };
  });

  return next;
}

export function useFolderManagerForChatsCount() {
  const forceUpdate = useForceUpdate();

  useEffect(() => addChatsCountCallback(forceUpdate), [forceUpdate]);

  return getChatsCount();
}

export function useFolderManagerForUnreadChatsByFolder() {
  const forceUpdate = useForceUpdate();

  useEffect(() => addUnreadChatsByFolderIdCallback(forceUpdate), [forceUpdate]);
  useEffect(() => privacyVault.subscribe(forceUpdate), [forceUpdate]);

  const unreadByFolder = getUnreadChatsByFolderId();
  if (!privacyVault.getHiddenChatIds().size) {
    return unreadByFolder;
  }

  const accountId = privacyVault.getCurrentAccountId();
  const next = { ...unreadByFolder };
  Object.keys(unreadByFolder).forEach((folderId) => {
    next[folderId] = privacyVault.filterHiddenChatIds(accountId, unreadByFolder[folderId]);
  });
  return next;
}
