import { memo, useMemo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiUser } from '../../../api/types';
import type { AccountInfo, AccountProfileKind, CustomPeer } from '../../../types';

import { MULTIACCOUNT_MAX_SLOTS } from '../../../config';
import { temporarilySuspendCacheUpdate } from '../../../global/cache';
import { openAccountProfiles } from '../../../util/accountProfilesUi';
import { IS_SAFARI } from '../../../util/browser/windowEnvironment';
import {
  ACCOUNT_SLOT,
  getAccountDisplayName,
  getAccountSlotUrl,
  getNextFreeAccountSlot,
} from '../../../util/multiaccount';
import { privacyVault } from '../../../util/privacyVault';
import { REM } from '../../common/helpers/mediaDimensions';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMultiaccountInfo from '../../../hooks/useMultiaccountInfo';
import { usePrivacyRevision } from '../../../hooks/usePrivacyVault';

import Avatar from '../../common/Avatar';
import FullNameTitle from '../../common/FullNameTitle';
import MenuItem from '../../ui/MenuItem';
import MenuSeparator from '../../ui/MenuSeparator';

type OwnProps = {
  currentUser: ApiUser;
  onSelectCurrent?: VoidFunction;
};

const MENU_ACCOUNT_CAP = 8;

const KIND_KEYS: Record<AccountProfileKind, 'AirProfilesKindPersonal' | 'AirProfilesKindBusiness'
  | 'AirProfilesKindAdmin'> = {
  personal: 'AirProfilesKindPersonal',
  business: 'AirProfilesKindBusiness',
  admin: 'AirProfilesKindAdmin',
};

const AccountMenuItems = ({
  currentUser,
  onSelectCurrent,
}: OwnProps) => {
  const { showNotification } = getActions();
  const lang = useLang();
  const accounts = useMultiaccountInfo(currentUser);
  const privacyRevision = usePrivacyRevision();
  const currentSlot = ACCOUNT_SLOT || 1;

  const currentAccountInfo = useMemo(() => {
    return Object.values(accounts).find((account) => account.userId === currentUser.id);
  }, [accounts, currentUser.id]);

  const accountEntries = useMemo(() => {
    void privacyRevision;
    return Object.entries(accounts)
      .map(([slot, account]) => ({ slot: Number(slot), account }))
      .filter(({ slot, account }) => {
        const isCurrent = account.userId === currentUser.id || slot === currentSlot;
        if (!privacyVault.isAccountHidden(String(slot))) return true;
        return isCurrent && privacyVault.isVaultUnlocked();
      })
      .sort((a, b) => {
        if (a.account.userId === currentUser.id) return -1;
        if (b.account.userId === currentUser.id) return 1;
        return a.slot - b.slot;
      });
  }, [accounts, currentUser.id, currentSlot, privacyRevision]);

  const visibleAccounts = accountEntries.length > MENU_ACCOUNT_CAP
    ? accountEntries.slice(0, MENU_ACCOUNT_CAP)
    : accountEntries;
  const hiddenCount = Math.max(0, accountEntries.length - visibleAccounts.length);

  const handleAccountClick = useLastCallback((account: AccountInfo) => {
    if (account.userId === currentUser.id) {
      onSelectCurrent?.();
      return;
    }

    if (IS_SAFARI) temporarilySuspendCacheUpdate();
  });

  const handleNewAccountClick = useLastCallback(() => {
    const nextSlot = getNextFreeAccountSlot(accounts);
    if (nextSlot > MULTIACCOUNT_MAX_SLOTS) {
      showNotification({
        message: lang('AirProfilesSlotLimit'),
      });
      return;
    }

    if (IS_SAFARI) temporarilySuspendCacheUpdate();
  });

  const newAccountUrl = useMemo(() => {
    const nextSlot = getNextFreeAccountSlot(accounts);
    if (nextSlot > MULTIACCOUNT_MAX_SLOTS) return undefined;
    return getAccountSlotUrl(nextSlot, true);
  }, [accounts]);

  const handleManageClick = useLastCallback(() => {
    openAccountProfiles();
  });

  const handleHideCurrent = useLastCallback(() => {
    const slotId = String(currentSlot);
    if (privacyVault.isAccountHidden(slotId)) {
      if (privacyVault.hasPin() && !privacyVault.isVaultUnlocked()) {
        privacyVault.openVault();
        return;
      }
      void privacyVault.unhideAccount(slotId);
      return;
    }

    void privacyVault.hideAccount(slotId).then(() => {
      const visible = Object.entries(accounts)
        .map(([slot]) => Number(slot))
        .filter((slot) => !privacyVault.isAccountHidden(String(slot)));
      privacyVault.lockVault();
      if (visible.length) {
        const target = accounts[visible[0]];
        window.location.href = getAccountSlotUrl(visible[0], undefined, target.isTest);
        return;
      }
      privacyVault.openVault();
    });
  });

  return (
    <>
      {visibleAccounts.map(({ slot, account }) => {
        const isSameServer = account.isTest === currentAccountInfo?.isTest;
        const mockUser: CustomPeer = {
          title: getAccountDisplayName(account),
          isCustomPeer: true,
          peerColorId: account.color,
          emojiStatusId: isSameServer ? account.emojiStatusId : undefined,
          isPremium: account.isPremium,
        };
        const kindLabel = account.profileKind ? lang(KIND_KEYS[account.profileKind]) : undefined;
        const hasSeparator = account.userId === currentUser.id && (newAccountUrl || visibleAccounts.length > 1);

        return (
          <>
            <MenuItem
              key={slot}
              className="account-menu-item"
              customIcon={(
                <Avatar
                  size="mini"
                  className="account-avatar"
                  peer={mockUser}
                  previewUrl={account.avatarUri}
                />
              )}
              onClick={() => handleAccountClick(account)}
              href={account.userId !== currentUser.id ? getAccountSlotUrl(slot, undefined, account.isTest) : undefined}
            >
              {account.isTest && <span className="account-menu-item-test">T</span>}
              <FullNameTitle peer={mockUser} withEmojiStatus emojiStatusSize={REM} />
              {kindLabel && <span className="account-menu-item-kind">{kindLabel}</span>}
            </MenuItem>
            {hasSeparator && <MenuSeparator />}
          </>
        );
      })}
      {hiddenCount > 0 && (
        <MenuItem icon="more" onClick={handleManageClick}>
          {lang('AirProfilesMore', { count: hiddenCount }, { pluralValue: hiddenCount })}
        </MenuItem>
      )}
      {newAccountUrl && (
        <MenuItem
          icon="add"
          rel="noopener"
          href={newAccountUrl}
          onClick={handleNewAccountClick}
        >
          {lang('MenuAddAccount')}
        </MenuItem>
      )}
      <MenuItem icon="settings" onClick={handleManageClick}>
        {lang('AirProfilesManage')}
      </MenuItem>
      <MenuItem icon="lock" onClick={handleHideCurrent}>
        {privacyVault.isAccountHidden(String(currentSlot))
          ? lang('AirHiddenUnhideAccount')
          : lang('AirHiddenHideAccount')}
      </MenuItem>
    </>
  );
};

export default memo(AccountMenuItems);
