import { memo, useEffect, useMemo, useRef, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';
import type { AccountInfo, AccountProfileKind, CustomPeer } from '../../../types';
import type { MenuItemContextAction } from '../../ui/ListItem';

import { MULTIACCOUNT_MAX_SLOTS } from '../../../config';
import { temporarilySuspendCacheUpdate } from '../../../global/cache';
import { selectUser } from '../../../global/selectors';
import {
  downloadAccountsBackup,
  importAccountsBackup,
  parseAccountsBackup,
} from '../../../util/accountBackup';
import { closeAccountProfiles } from '../../../util/accountProfilesUi';
import { IS_SAFARI } from '../../../util/browser/windowEnvironment';
import {
  ACCOUNT_SLOT,
  getAccountDisplayName,
  getAccountSlotUrl,
  getNextFreeAccountSlot,
  storeAccountData,
} from '../../../util/multiaccount';

import useAccountProfilesUi from '../../../hooks/useAccountProfilesUi';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMultiaccountInfo from '../../../hooks/useMultiaccountInfo';

import Avatar from '../../common/Avatar';
import FullNameTitle from '../../common/FullNameTitle';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import InputText from '../../ui/InputText';
import ListItem from '../../ui/ListItem';
import Modal from '../../ui/Modal';

import styles from './AccountProfilesModal.module.scss';

type StateProps = {
  currentUser?: ApiUser;
};

const KIND_KEYS: Record<AccountProfileKind, 'AirProfilesKindPersonal' | 'AirProfilesKindBusiness'
  | 'AirProfilesKindAdmin'> = {
  personal: 'AirProfilesKindPersonal',
  business: 'AirProfilesKindBusiness',
  admin: 'AirProfilesKindAdmin',
};
const PROFILE_KINDS: AccountProfileKind[] = ['personal', 'business', 'admin'];
const NOTIFICATION_DURATION = 5000;

const AccountProfilesModal = ({ currentUser }: StateProps) => {
  const { showNotification } = getActions();
  const lang = useLang();
  const { isOpen } = useAccountProfilesUi();
  const accounts = useMultiaccountInfo(currentUser);
  const fileInputRef = useRef<HTMLInputElement>();
  const [searchQuery, setSearchQuery] = useState('');
  const [labelSlot, setLabelSlot] = useState<number | undefined>();
  const [labelDraft, setLabelDraft] = useState('');
  const [isBackupConfirmOpen, openBackupConfirm, closeBackupConfirm] = useFlag();
  const [isLabelOpen, openLabel, closeLabel] = useFlag();

  useEffect(() => {
    if (isOpen) return;
    setSearchQuery('');
    closeBackupConfirm();
    closeLabel();
    setLabelSlot(undefined);
    setLabelDraft('');
  }, [closeBackupConfirm, closeLabel, isOpen]);

  const currentSlot = ACCOUNT_SLOT || 1;
  const accountEntries = useMemo(() => (
    Object.entries(accounts)
      .map(([slot, account]) => ({ slot: Number(slot), account }))
      .sort((a, b) => {
        if (a.account.userId === currentUser?.id) return -1;
        if (b.account.userId === currentUser?.id) return 1;
        return a.slot - b.slot;
      })
  ), [accounts, currentUser?.id]);

  const filteredAccounts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return accountEntries;
    return accountEntries.filter(({ account }) => {
      const haystack = [
        account.profileLabel,
        account.firstName,
        account.lastName,
        account.phone,
        account.profileKind,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [accountEntries, searchQuery]);

  const addAccountUrl = useMemo(() => {
    const nextSlot = getNextFreeAccountSlot(accounts);
    if (nextSlot > MULTIACCOUNT_MAX_SLOTS) return undefined;
    return getAccountSlotUrl(nextSlot, true);
  }, [accounts]);

  const handleClose = useLastCallback(() => {
    closeAccountProfiles();
  });

  const handleSearchChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  });

  const handleAccountClick = useLastCallback((account: AccountInfo) => {
    if (account.userId === currentUser?.id) return;
    if (IS_SAFARI) temporarilySuspendCacheUpdate();
  });

  const handleAddAccount = useLastCallback(() => {
    if (IS_SAFARI) temporarilySuspendCacheUpdate();
  });

  const handleSetKind = useLastCallback((slot: number, profileKind: AccountProfileKind) => {
    storeAccountData(slot, { profileKind });
  });

  const handleOpenLabel = useLastCallback((slot: number, account: AccountInfo) => {
    setLabelSlot(slot);
    setLabelDraft(account.profileLabel || '');
    openLabel();
  });

  const handleLabelChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLabelDraft(e.target.value);
  });

  const handleSaveLabel = useLastCallback(() => {
    if (labelSlot === undefined) return;
    const profileLabel = labelDraft.trim() || undefined;
    storeAccountData(labelSlot, { profileLabel });
    closeLabel();
  });

  const handleExportOne = useLastCallback((slot: number) => {
    const count = downloadAccountsBackup([slot]);
    if (!count) return;
    showNotification({
      message: lang('AirProfilesBackupDone', { count }, { pluralValue: count }),
      duration: NOTIFICATION_DURATION,
    });
  });

  const handleExportAll = useLastCallback(() => {
    closeBackupConfirm();
    const count = downloadAccountsBackup();
    if (!count) return;
    showNotification({
      message: lang('AirProfilesBackupDone', { count }, { pluralValue: count }),
      duration: NOTIFICATION_DURATION,
    });
  });

  const handlePickBackup = useLastCallback(() => {
    fileInputRef.current?.click();
  });

  const handleImportFile = useLastCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const raw = await file.text();
    const backup = parseAccountsBackup(raw);
    if (!backup) {
      showNotification({
        message: lang('AirProfilesInvalidBackup'),
        duration: NOTIFICATION_DURATION,
      });
      return;
    }

    const { imported, skipped } = importAccountsBackup(backup);
    if (imported) {
      showNotification({
        message: lang('AirProfilesRestoreDone', { count: imported }, { pluralValue: imported }),
        duration: NOTIFICATION_DURATION,
      });
    }
    if (skipped) {
      showNotification({
        message: lang('AirProfilesRestoreSkip', { count: skipped }, { pluralValue: skipped }),
        duration: NOTIFICATION_DURATION,
      });
    }
  });

  function buildContextActions(slot: number, account: AccountInfo): MenuItemContextAction[] {
    const kindActions: MenuItemContextAction[] = PROFILE_KINDS.map((kind) => ({
      title: lang(KIND_KEYS[kind]),
      icon: 'tag',
      handler: () => handleSetKind(slot, kind),
    }));

    return [
      ...kindActions,
      { isSeparator: true, key: 'profile-label' },
      {
        title: lang('AirProfilesRename'),
        icon: 'user',
        handler: () => handleOpenLabel(slot, account),
      },
      {
        title: lang('AirProfilesBackupOne'),
        icon: 'download',
        handler: () => handleExportOne(slot),
      },
    ];
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={lang('AirProfilesTitle')}
      hasCloseButton
      className={styles.root}
    >
      <p className={styles.hint}>{lang('AirProfilesUnlimited')}</p>
      <InputText
        value={searchQuery}
        label={lang('AirProfilesSearch')}
        onChange={handleSearchChange}
      />
      <div className={styles.list}>
        {filteredAccounts.length ? filteredAccounts.map(({ slot, account }) => {
          const isCurrent = account.userId === currentUser?.id || slot === currentSlot;
          const mockUser: CustomPeer = {
            title: getAccountDisplayName(account) || lang('AirProfilesTitle'),
            isCustomPeer: true,
            peerColorId: account.color,
            emojiStatusId: account.emojiStatusId,
            isPremium: account.isPremium,
          };
          const kindLabel = account.profileKind ? lang(KIND_KEYS[account.profileKind]) : undefined;

          return (
            <ListItem
              key={slot}
              className={styles.item}
              multiline
              href={isCurrent ? undefined : getAccountSlotUrl(slot, undefined, account.isTest)}
              onClick={isCurrent ? undefined : () => handleAccountClick(account)}
              contextActions={buildContextActions(slot, account)}
              withPortalForMenu
              leftElement={(
                <Avatar
                  size="small"
                  className={styles.avatar}
                  peer={mockUser}
                  previewUrl={account.avatarUri}
                />
              )}
            >
              <span className="title">
                <FullNameTitle peer={mockUser} withEmojiStatus />
                {isCurrent && <span className={styles.current}>{lang('AirProfilesCurrent')}</span>}
                {account.isTest && <span className={styles.test}>T</span>}
              </span>
              <span className="subtitle">
                {[
                  account.profileLabel && [account.firstName, account.lastName].filter(Boolean).join(' '),
                  kindLabel || lang('AirProfilesKindPersonal'),
                ].filter(Boolean).join(' · ')}
              </span>
            </ListItem>
          );
        }) : (
          <p className={styles.empty}>{lang('AirProfilesEmpty')}</p>
        )}
      </div>
      <div className={styles.actions}>
        {addAccountUrl && (
          <Button
            size="smaller"
            href={addAccountUrl}
            onClick={handleAddAccount}
          >
            {lang('AirProfilesAdd')}
          </Button>
        )}
        <Button size="smaller" onClick={handlePickBackup}>
          {lang('AirProfilesRestore')}
        </Button>
        <Button size="smaller" color="primary" onClick={openBackupConfirm}>
          {lang('AirProfilesBackup')}
        </Button>
      </div>
      <input
        ref={fileInputRef}
        className={styles.fileInput}
        type="file"
        accept="application/json,.json"
        onChange={handleImportFile}
      />
      <ConfirmDialog
        isOpen={isBackupConfirmOpen}
        onClose={closeBackupConfirm}
        title={lang('AirProfilesBackup')}
        text={lang('AirProfilesBackupWarning')}
        confirmLabel={lang('AirProfilesBackup')}
        confirmHandler={handleExportAll}
      />
      <ConfirmDialog
        isOpen={isLabelOpen}
        onClose={closeLabel}
        title={lang('AirProfilesRename')}
        confirmLabel={lang('Save')}
        confirmHandler={handleSaveLabel}
      >
        <InputText
          value={labelDraft}
          label={lang('AirProfilesRename')}
          onChange={handleLabelChange}
        />
      </ConfirmDialog>
    </Modal>
  );
};

export default memo(withGlobal((global): Complete<StateProps> => {
  const currentUserId = global.currentUserId;
  return {
    currentUser: currentUserId ? selectUser(global, currentUserId) : undefined,
  };
})(AccountProfilesModal));
