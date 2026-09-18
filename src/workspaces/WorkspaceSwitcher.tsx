import { memo } from '../lib/teact/teact';

import type { ChatHubWorkspace } from '../util/chatHub';

import buildClassName from '../util/buildClassName';
import { chatHubStore } from '../util/chatHub';

import useLang from '../hooks/useLang';

import Icon from '../components/common/icons/Icon';
import DropdownMenu from '../components/ui/DropdownMenu';
import MenuItem from '../components/ui/MenuItem';

import styles from './WorkspaceSwitcher.module.scss';

type OwnProps = {
  workspace: ChatHubWorkspace;
  className?: string;
};

const WorkspaceSwitcher = ({ workspace, className }: OwnProps) => {
  const lang = useLang();
  const isChatHub = workspace === 'chathub';

  return (
    <DropdownMenu
      className={buildClassName(styles.root, className)}
      positionY="bottom"
      withPortal
      trigger={({ onTrigger, isOpen }) => (
        <button
          type="button"
          className={buildClassName(styles.trigger, isOpen && styles.open)}
          onClick={onTrigger}
        >
          <Icon name={isChatHub ? 'forums' : 'chats-badge'} className={styles.icon} />
          <span className={styles.label}>
            {lang(isChatHub ? 'ChatHubWorkspaceChatHub' : 'ChatHubWorkspaceTelegram')}
          </span>
          <Icon name="arrow-down" className={styles.arrow} />
        </button>
      )}
    >
      <MenuItem
        icon="chats-badge"
        onClick={() => chatHubStore.openTelegram()}
      >
        <span className={styles.itemTitle}>{lang('ChatHubWorkspaceTelegram')}</span>
        <span className={styles.itemSubtitle}>{lang('ChatHubTelegramDesc')}</span>
      </MenuItem>
      <MenuItem
        icon="forums"
        onClick={() => chatHubStore.openChatHub()}
      >
        <span className={styles.itemTitle}>{lang('ChatHubWorkspaceChatHub')}</span>
        <span className={styles.itemSubtitle}>{lang('ChatHubDesc')}</span>
      </MenuItem>
    </DropdownMenu>
  );
};

export default memo(WorkspaceSwitcher);
