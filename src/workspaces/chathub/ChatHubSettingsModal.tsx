import { memo, useEffect, useState } from '../../lib/teact/teact';

import type { ChatHubController } from '../../hooks/useChatHub';

import buildClassName from '../../util/buildClassName';
import { DEFAULT_CHAT_HUB_HOTKEY } from '../../util/chatHub';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Checkbox from '../../components/ui/Checkbox';
import InputText from '../../components/ui/InputText';
import Modal from '../../components/ui/Modal';

import styles from './ChatHub.module.scss';

type OwnProps = {
  hub: ChatHubController;
};

const ChatHubSettingsModal = ({ hub }: OwnProps) => {
  const lang = useLang();
  const { settings } = hub;
  const [hotkeyDraft, setHotkeyDraft] = useState(settings.hotkey);

  useEffect(() => {
    if (hub.isSettingsOpen) {
      setHotkeyDraft(settings.hotkey);
    }
  }, [hub.isSettingsOpen, settings.hotkey]);

  const handleClose = useLastCallback(() => {
    hub.patchSettings({ hotkey: hotkeyDraft });
    hub.closeSettings();
  });

  return (
    <Modal
      className={styles.settingsRoot}
      isSlim
      isOpen={hub.isSettingsOpen}
      hasCloseButton
      title={lang('ChatHubSettings')}
      onClose={handleClose}
    >
      <Checkbox
        className={styles.settingsRow}
        label={lang('ChatHubShowAccountBadge')}
        checked={settings.showAccountBadge}
        onCheck={(isChecked) => hub.patchSettings({ showAccountBadge: isChecked })}
      />
      <Checkbox
        className={styles.settingsRow}
        label={lang('ChatHubShowAccountName')}
        checked={settings.showAccountName}
        onCheck={(isChecked) => hub.patchSettings({ showAccountName: isChecked })}
      />
      <Checkbox
        className={styles.settingsRow}
        label={lang('ChatHubShowUnreadCount')}
        checked={settings.showUnreadCount}
        onCheck={(isChecked) => hub.patchSettings({ showUnreadCount: isChecked })}
      />
      <Checkbox
        className={styles.settingsRow}
        label={lang('ChatHubShowFolders')}
        checked={settings.showFolders}
        onCheck={(isChecked) => hub.patchSettings({ showFolders: isChecked })}
      />
      <Checkbox
        className={styles.settingsRow}
        label={lang('ChatHubShowChannels')}
        checked={settings.showChannels}
        onCheck={(isChecked) => hub.patchSettings({ showChannels: isChecked })}
      />
      <Checkbox
        className={styles.settingsRow}
        label={lang('ChatHubShowBots')}
        checked={settings.showBots}
        onCheck={(isChecked) => hub.patchSettings({ showBots: isChecked })}
      />
      <Checkbox
        className={styles.settingsRow}
        label={lang('ChatHubCompactMode')}
        checked={settings.compactMode}
        onCheck={(isChecked) => hub.patchSettings({ compactMode: isChecked })}
      />
      <InputText
        className={buildClassName(styles.settingsRow, styles.hotkeyField)}
        label={lang('ChatHubHotkey')}
        value={hotkeyDraft}
        placeholder={DEFAULT_CHAT_HUB_HOTKEY}
        onChange={(e) => setHotkeyDraft(e.currentTarget.value)}
        onBlur={() => hub.patchSettings({ hotkey: hotkeyDraft })}
      />
    </Modal>
  );
};

export default memo(ChatHubSettingsModal);
