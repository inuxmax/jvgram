import type {
  ApiInputPrivacyRules,
  BotsPrivacyType,
  PrivacyVisibility,
} from '../../api/types';
import type { GlobalState } from '../types';

import { MULTIACCOUNT_MAX_SLOTS } from '../../config';
import { isUserId } from '../../util/entities/ids';
import { partition } from '../../util/iteratees';
import { getAccountsInfo } from '../../util/multiaccount';

export function buildApiInputPrivacyRules(global: GlobalState, {
  visibility,
  isUnspecified,
  allowedIds,
  blockedIds,
  shouldAllowPremium,
  botsPrivacy,
}: {
  visibility: PrivacyVisibility;
  isUnspecified?: boolean;
  allowedIds: string[];
  blockedIds: string[];
  shouldAllowPremium?: true;
  botsPrivacy: BotsPrivacyType;
}): ApiInputPrivacyRules {
  const {
    users: { byId: usersById },
    chats: { byId: chatsById },
  } = global;

  const [allowedUserIds, allowedChatIds] = partition(allowedIds, isUserId);
  const [blockedUserIds, blockedChatIds] = partition(blockedIds, isUserId);

  const rules: ApiInputPrivacyRules = {
    visibility,
    isUnspecified,
    allowedUsers: allowedUserIds.map((userId) => usersById[userId]).filter(Boolean),
    allowedChats: allowedChatIds.map((chatId) => chatsById[chatId]).filter(Boolean),
    blockedUsers: blockedUserIds.map((userId) => usersById[userId]).filter(Boolean),
    blockedChats: blockedChatIds.map((chatId) => chatsById[chatId]).filter(Boolean),
    shouldAllowPremium,
    botsPrivacy,
  };

  return rules;
}

export function getCurrentMaxAccountCount() {
  return MULTIACCOUNT_MAX_SLOTS;
}

export function getCurrentProdAccountCount() {
  return Object.values(getAccountsInfo()).filter((account) => !account.isTest).length;
}
