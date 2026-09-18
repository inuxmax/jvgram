import { memo, useEffect, useMemo, useState } from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { CustomPeer } from '../../../types';

import { getChatTitle, getUserFullName } from '../../../global/helpers';
import { selectCurrentMessageList } from '../../../global/selectors';
import {
  ACCOUNT_SLOT,
  getAccountDisplayName,
  getAccountsInfo,
  getAccountSlotUrl,
} from '../../../util/multiaccount';
import { MIN_PIN_LENGTH, parseAutoLockMs, privacyVault as vault } from '../../../util/privacyVault';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import usePrivacyVault from '../../../hooks/usePrivacyVault';

import Avatar from '../../common/Avatar';
import Icon from '../../common/icons/Icon';
import PasswordForm from '../../common/PasswordForm';
import Checkbox from '../../ui/Checkbox';
import ConfirmDialog from '../../ui/ConfirmDialog';
import ListItem from '../../ui/ListItem';
import Modal from '../../ui/Modal';
import RadioGroup from '../../ui/RadioGroup';
import SearchInput from '../../ui/SearchInput';
import Select from '../../ui/Select';

import styles from './PrivacyVaultModal.module.scss';

type PinStep = 'unlock' | 'create' | 'change' | 'remove';

const PANIC_HOTKEYS = ['Ctrl+Shift+H', 'Ctrl+Shift+P', 'Mod+Shift+H'] as const;

const PrivacyVaultModal = () => {
  const { openChat, showNotification } = getActions();
  const lang = useLang();
  const snapshot = usePrivacyVault();
  const accounts = useMemo(() => {
    void snapshot.revision;
    return getAccountsInfo();
  }, [snapshot.revision]);
  const currentSlot = ACCOUNT_SLOT || 1;
  const isCurrentHidden = snapshot.hiddenAccounts.some((item) => Number(item.accountId) === currentSlot);
  const isForced = isCurrentHidden && snapshot.hasPin && !snapshot.isUnlocked;
  const isOpen = snapshot.isUiOpen || isForced;

  const [pinStep, setPinStep] = useState<PinStep>('unlock');
  const [pinError, setPinError] = useState<string | undefined>();
  const [isPinVisible, showPin, hidePin] = useFlag();
  const [pendingPin, setPendingPin] = useState<string | undefined>();
  const [unhideChatId, setUnhideChatId] = useState<string | undefined>();
  const [unhideAccountId, setUnhideAccountId] = useState<string | undefined>();
  const [isRemovePinOpen, openRemovePin, closeRemovePin] = useFlag();
  const [hiddenChatQuery, setHiddenChatQuery] = useState('');

  const needsUnlock = snapshot.hasPin && !snapshot.isUnlocked;
  const activeStep = needsUnlock ? 'unlock' : pinStep === 'unlock' ? undefined : pinStep;

  useEffect(() => {
    if (snapshot.isUnlocked) return;
    const chatId = selectCurrentMessageList(getGlobal())?.chatId;
    if (chatId && vault.isChatHidden(snapshot.accountId, chatId)) {
      openChat({ id: undefined });
    }
  }, [openChat, snapshot.accountId, snapshot.isUnlocked, snapshot.revision]);

  useEffect(() => {
    if (!isOpen) {
      setPinStep('unlock');
      setPinError(undefined);
      hidePin();
      setPendingPin(undefined);
      setHiddenChatQuery('');
    }
  }, [hidePin, isOpen]);

  const handleClose = useLastCallback(() => {
    if (isForced) return;
    if (activeStep && activeStep !== 'unlock') {
      setPinStep('unlock');
      setPinError(undefined);
      setPendingPin(undefined);
      return;
    }
    vault.closeVault();
  });

  const handlePinVisibility = useLastCallback((isVisible: boolean) => {
    if (isVisible) {
      showPin();
      return;
    }
    hidePin();
  });

  const handleUnlock = useLastCallback(async (pin: string) => {
    setPinError(undefined);
    const isOk = await vault.unlockVault(pin);
    if (isOk) {
      hidePin();
      return;
    }
    const remaining = vault.getLockRemainingMs();
    setPinError(remaining > 0 ? lang('AirHiddenPinLocked') : lang('AirHiddenPinWrong'));
  });

  const handleCreatePin = useLastCallback(async (pin: string) => {
    if (pin.length < MIN_PIN_LENGTH) {
      setPinError(lang('AirHiddenPinMin'));
      return;
    }
    if (!pendingPin) {
      setPendingPin(pin);
      setPinError(undefined);
      hidePin();
      return;
    }
    if (pendingPin !== pin) {
      setPinError(lang('AirHiddenPinMismatch'));
      setPendingPin(undefined);
      return;
    }
    const isOk = await vault.setPin(pin);
    if (!isOk) {
      setPinError(lang('AirHiddenPinWrong'));
      return;
    }
    setPendingPin(undefined);
    setPinStep('unlock');
    hidePin();
    showNotification({ message: lang('AirHiddenPinCreated') });
  });

  const handleChangePin = useLastCallback(async (pin: string) => {
    if (!pendingPin) {
      const isOk = await vault.unlockVault(pin);
      if (!isOk) {
        setPinError(lang('AirHiddenPinWrong'));
        return;
      }
      setPendingPin(pin);
      setPinError(undefined);
      hidePin();
      return;
    }
    if (pin.length < MIN_PIN_LENGTH) {
      setPinError(lang('AirHiddenPinMin'));
      return;
    }
    const isOk = await vault.setPin(pin, pendingPin);
    if (!isOk) {
      setPinError(lang('AirHiddenPinWrong'));
      setPendingPin(undefined);
      return;
    }
    setPendingPin(undefined);
    setPinStep('unlock');
    hidePin();
    showNotification({ message: lang('AirHiddenPinCreated') });
  });

  const handleRemovePin = useLastCallback(async (pin: string) => {
    const isOk = await vault.removePin(pin);
    if (!isOk) {
      setPinError(lang('AirHiddenPinWrong'));
      return;
    }
    closeRemovePin();
    setPinStep('unlock');
    hidePin();
    showNotification({ message: lang('AirHiddenPinRemoved') });
  });

  const handleOpenChat = useLastCallback((chatId: string) => {
    openChat({ id: chatId });
    vault.closeVault();
  });

  const handleConfirmUnhideChat = useLastCallback(() => {
    if (!unhideChatId) return;
    void vault.unhideChat(snapshot.accountId, unhideChatId);
    setUnhideChatId(undefined);
    showNotification({ message: lang('AirHiddenChatShown') });
  });

  const handleConfirmUnhideAccount = useLastCallback(() => {
    if (!unhideAccountId) return;
    void vault.unhideAccount(unhideAccountId);
    setUnhideAccountId(undefined);
    showNotification({ message: lang('AirHiddenAccountShown') });
  });

  function resolveHiddenChatTitle(chatId: string) {
    const global = getGlobal();
    const chat = global.chats.byId[chatId];
    if (chat) {
      return getChatTitle(lang, chat);
    }
    const userName = getUserFullName(global.users.byId[chatId]);
    return userName || lang('AirHiddenUnknown');
  }

  function resolveHiddenPeer(chatId: string) {
    const global = getGlobal();
    return global.chats.byId[chatId] || global.users.byId[chatId];
  }

  const visibleHiddenChats = useMemo(() => {
    void snapshot.revision;
    const query = hiddenChatQuery.trim().toLowerCase();
    const global = getGlobal();
    if (!query) {
      return snapshot.hiddenChats;
    }
    return snapshot.hiddenChats.filter((item) => {
      const chat = global.chats.byId[item.chatId];
      const title = chat
        ? getChatTitle(lang, chat)
        : (getUserFullName(global.users.byId[item.chatId]) || '');
      return title.toLowerCase().includes(query);
    });
  }, [hiddenChatQuery, lang, snapshot.hiddenChats, snapshot.revision]);

  const autoLockOptions = useMemo(() => ([
    { label: lang('AirHiddenAutoNever'), value: '0' },
    { label: lang('AirHiddenAuto1m'), value: '60000' },
    { label: lang('AirHiddenAuto5m'), value: '300000' },
    { label: lang('AirHiddenAuto15m'), value: '900000' },
    { label: lang('AirHiddenAuto30m'), value: '1800000' },
  ]), [lang]);

  const pinPlaceholder = pendingPin
    ? lang('AirHiddenConfirmPin')
    : activeStep === 'change'
      ? lang('AirHiddenCurrentPin')
      : lang('AirHiddenEnterPin');

  function renderPinForm(onSubmit: (pin: string) => void) {
    return (
      <PasswordForm
        error={pinError}
        hint={lang('AirHiddenVault')}
        placeholder={pinPlaceholder}
        submitLabel={lang('AirHiddenUnlock')}
        shouldShowSubmit
        shouldDisablePasswordManager
        isPasswordVisible={isPinVisible}
        shouldResetValue={Boolean(pinError)}
        onClearError={() => setPinError(undefined)}
        onChangePasswordVisibility={handlePinVisibility}
        onSubmit={onSubmit}
      />
    );
  }

  function renderHiddenAccounts() {
    if (!snapshot.hiddenAccounts.length) {
      return <p className={styles.empty}>{lang('AirHiddenEmptyAccounts')}</p>;
    }

    return (
      <div className={styles.list}>
        {snapshot.hiddenAccounts.map((item) => {
          const slot = Number(item.accountId);
          const account = accounts[slot];
          const title = account ? getAccountDisplayName(account) : lang('AirHiddenUnknown');
          const mockUser: CustomPeer = {
            title,
            isCustomPeer: true,
            peerColorId: account?.color,
            isPremium: account?.isPremium,
          };

          return (
            <ListItem
              key={item.accountId}
              className={styles.item}
              multiline
              href={slot === currentSlot ? undefined : getAccountSlotUrl(slot, undefined, account?.isTest)}
              leftElement={(
                <Avatar size="small" className={styles.avatar} peer={mockUser} previewUrl={account?.avatarUri} />
              )}
              contextActions={[{
                title: lang('AirHiddenUnhideAccount'),
                icon: 'eye',
                handler: () => setUnhideAccountId(item.accountId),
              }]}
              withPortalForMenu
            >
              <span className="title">{title}</span>
            </ListItem>
          );
        })}
      </div>
    );
  }

  function renderHiddenChats() {
    if (!snapshot.hiddenChats.length) {
      return <p className={styles.empty}>{lang('AirHiddenEmptyChats')}</p>;
    }

    return (
      <>
        <SearchInput
          className={styles.search}
          value={hiddenChatQuery}
          placeholder={lang('AirHiddenSearchChats')}
          canClose={Boolean(hiddenChatQuery)}
          onChange={setHiddenChatQuery}
          onReset={() => setHiddenChatQuery('')}
        />
        {!visibleHiddenChats.length && (
          <p className={styles.empty}>{lang('AirHiddenSearchEmpty')}</p>
        )}
        <div className={styles.list}>
          {visibleHiddenChats.map((item) => {
            const peer = resolveHiddenPeer(item.chatId);
            const title = resolveHiddenChatTitle(item.chatId);

            return (
              <ListItem
                key={item.chatId}
                className={styles.item}
                multiline
                onClick={peer ? () => handleOpenChat(item.chatId) : undefined}
                leftElement={peer ? (
                  <Avatar size="small" className={styles.avatar} peer={peer} />
                ) : undefined}
                contextActions={[{
                  title: lang('AirHiddenUnhideChat'),
                  icon: 'eye',
                  handler: () => setUnhideChatId(item.chatId),
                }]}
                withPortalForMenu
              >
                <span className="title">{title}</span>
              </ListItem>
            );
          })}
        </div>
      </>
    );
  }

  function renderSettings() {
    return (
      <div className={styles.settings}>
        <h3 className={styles.sectionTitle}>{lang('AirHiddenLock')}</h3>
        {!snapshot.hasPin && (
          <ListItem
            icon="lock"
            narrow
            onClick={() => {
              setPendingPin(undefined);
              setPinStep('create');
            }}
          >
            {lang('AirHiddenSetPin')}
          </ListItem>
        )}
        {snapshot.hasPin && (
          <>
            <ListItem
              icon="lock"
              narrow
              onClick={() => {
                setPendingPin(undefined);
                setPinStep('change');
              }}
            >
              {lang('AirHiddenChangePin')}
            </ListItem>
            <ListItem
              icon="delete"
              destructive
              narrow
              onClick={openRemovePin}
            >
              {lang('AirHiddenRemovePin')}
            </ListItem>
          </>
        )}

        <h3 className={styles.sectionTitle}>{lang('AirHiddenAutoLock')}</h3>
        <RadioGroup
          name="airHiddenAutoLock"
          options={autoLockOptions}
          selected={String(snapshot.autoLockMs)}
          onChange={(value) => {
            const next = parseAutoLockMs(value);
            if (next !== undefined) {
              void vault.setAutoLockMs(next);
            }
          }}
        />

        <h3 className={styles.sectionTitle}>{lang('AirHiddenProtect')}</h3>
        <Checkbox
          label={lang('AirHiddenHideNotifs')}
          checked={snapshot.hideNotifications}
          onCheck={(isChecked) => {
            void vault.setHideNotifications(isChecked);
          }}
        />
        <Checkbox
          label={lang('AirHiddenHidePreview')}
          checked={snapshot.hideNotificationPreview}
          onCheck={(isChecked) => {
            void vault.setHideNotificationPreview(isChecked);
          }}
        />
        <Checkbox
          label={lang('AirHiddenHideSearch')}
          checked={snapshot.hideFromSearch}
          onCheck={(isChecked) => {
            void vault.setHideFromSearch(isChecked);
          }}
        />

        <Select
          label={lang('AirHiddenPanic')}
          value={snapshot.panicHotkey}
          hasArrow
          onChange={(e) => {
            void vault.setPanicHotkey(e.currentTarget.value);
          }}
        >
          {PANIC_HOTKEYS.map((hotkey) => (
            <option key={hotkey} value={hotkey}>{hotkey.replaceAll('+', ' + ')}</option>
          ))}
        </Select>
      </div>
    );
  }

  function renderBody() {
    if (activeStep === 'unlock') {
      return (
        <>
          <div className={styles.lockIcon}><Icon name="lock" /></div>
          <p className={styles.hint}>{lang('AirHiddenEnterPin')}</p>
          {renderPinForm(handleUnlock)}
        </>
      );
    }

    if (activeStep === 'create') {
      return renderPinForm(handleCreatePin);
    }

    if (activeStep === 'change') {
      return renderPinForm(handleChangePin);
    }

    return (
      <>
        <p className={styles.hint}>{lang('AirHiddenManageHint')}</p>
        <h3 className={styles.sectionTitle}>{lang('AirHiddenAccounts')}</h3>
        {renderHiddenAccounts()}
        <h3 className={styles.sectionTitle}>{lang('AirHiddenChats')}</h3>
        {renderHiddenChats()}
        {renderSettings()}
      </>
    );
  }

  const content = (
    <>
      {renderBody()}
      <ConfirmDialog
        isOpen={Boolean(unhideChatId)}
        title={lang('AirHiddenUnhideChat')}
        text={lang('AirHiddenConfirmChat')}
        confirmLabel={lang('AirHiddenUnhideChat')}
        confirmHandler={handleConfirmUnhideChat}
        onClose={() => setUnhideChatId(undefined)}
      />
      <ConfirmDialog
        isOpen={Boolean(unhideAccountId)}
        title={lang('AirHiddenUnhideAccount')}
        text={lang('AirHiddenConfirmAccount')}
        confirmLabel={lang('AirHiddenUnhideAccount')}
        confirmHandler={handleConfirmUnhideAccount}
        onClose={() => setUnhideAccountId(undefined)}
      />
      <ConfirmDialog
        isOpen={isRemovePinOpen}
        title={lang('AirHiddenRemovePin')}
        text={lang('AirHiddenConfirmRemovePin')}
        confirmLabel={lang('AirHiddenContinue')}
        confirmHandler={() => {
          closeRemovePin();
          setPendingPin(undefined);
          setPinStep('remove');
        }}
        onClose={closeRemovePin}
      />
    </>
  );

  if (isForced) {
    return (
      <div className={styles.overlay}>
        <div className={styles.overlayCard}>
          {activeStep === 'remove' ? renderPinForm(handleRemovePin) : content}
        </div>
      </div>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={lang('AirHiddenVault')}
      hasCloseButton
      className={styles.root}
    >
      {activeStep === 'remove' ? renderPinForm(handleRemovePin) : content}
    </Modal>
  );
};

export default memo(PrivacyVaultModal);
