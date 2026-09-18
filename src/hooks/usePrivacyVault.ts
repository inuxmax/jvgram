import { useEffect, useMemo } from '../lib/teact/teact';

import type { SearchResultKey } from '../util/keys/searchResultKey';

import { privacyVault } from '../util/privacyVault';
import useForceUpdate from './useForceUpdate';

export function usePrivacyRevision() {
  const forceUpdate = useForceUpdate();

  useEffect(() => privacyVault.subscribe(forceUpdate), [forceUpdate]);

  return privacyVault.getRevision();
}

export function useVisibleSearchResultKeys(foundIds?: SearchResultKey[]) {
  const revision = usePrivacyRevision();

  return useMemo(() => {
    void revision;
    if (!foundIds) {
      return foundIds;
    }
    return privacyVault.filterHiddenSearchResults(foundIds);
  }, [foundIds, revision]);
}

export function useVisiblePeerIds(peerIds?: string[]) {
  const revision = usePrivacyRevision();

  return useMemo(() => {
    void revision;
    return privacyVault.filterHiddenPeerIds(peerIds);
  }, [peerIds, revision]);
}

export default function usePrivacyVault() {
  const revision = usePrivacyRevision();
  const persisted = privacyVault.getPersisted();

  useEffect(() => {
    void privacyVault.init();
  }, []);

  return {
    revision,
    isUnlocked: privacyVault.isVaultUnlocked(),
    isUiOpen: privacyVault.isUiOpen(),
    hasPin: privacyVault.hasPin(),
    autoLockMs: persisted.autoLockMs,
    hideFromSearch: persisted.hideFromSearch,
    hideNotifications: persisted.hideNotifications,
    hideNotificationPreview: persisted.hideNotificationPreview,
    panicHotkey: persisted.panicHotkey,
    lockRemainingMs: privacyVault.getLockRemainingMs(),
    hiddenChats: privacyVault.getHiddenChats(),
    hiddenAccounts: privacyVault.getHiddenAccounts(),
    accountId: privacyVault.getCurrentAccountId(),
  };
}
