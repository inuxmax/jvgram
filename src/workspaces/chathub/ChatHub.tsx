import { memo, useEffect } from '../../lib/teact/teact';

import { IS_TAURI } from '../../util/browser/globalEnvironment';
import { IS_MAC_OS } from '../../util/browser/windowEnvironment';
import buildClassName from '../../util/buildClassName';
import captureEscKeyListener from '../../util/captureEscKeyListener';

import useChatHub from '../../hooks/useChatHub';

import ChatHubHeader from './ChatHubHeader';
import ChatHubSettingsModal from './ChatHubSettingsModal';
import ChatHubSidebar from './ChatHubSidebar';
import UnifiedChatList from './UnifiedChatList';

import styles from './ChatHub.module.scss';

const ChatHub = () => {
  const hub = useChatHub();

  useEffect(() => captureEscKeyListener(hub.openTelegram), [hub.openTelegram]);

  return (
    <div className={buildClassName(styles.root, hub.settings.compactMode && styles.compact)}>
      {IS_TAURI && IS_MAC_OS && (
        <div className="tauri-drag-region" data-tauri-drag-region />
      )}
      <ChatHubHeader hub={hub} />
      <div className={styles.body}>
        <ChatHubSidebar hub={hub} />
        <UnifiedChatList hub={hub} />
      </div>
      <ChatHubSettingsModal hub={hub} />
    </div>
  );
};

export default memo(ChatHub);
