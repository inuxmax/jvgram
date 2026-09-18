import { memo } from '../../lib/teact/teact';

import type { ChatHubController } from '../../hooks/useChatHub';
import type { IconName } from '../../types/icons';
import type { RegularLangKey } from '../../types/language';
import type { ChatHubFilter } from '../../util/chatHub';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import Icon from '../../components/common/icons/Icon';

import styles from './ChatHub.module.scss';

type OwnProps = {
  hub: ChatHubController;
};

const FILTERS: Array<{ id: ChatHubFilter; icon: IconName; key: RegularLangKey }> = [
  { id: 'all', icon: 'forums', key: 'ChatHubAllAccounts' },
  { id: 'priority', icon: 'star', key: 'ChatHubPriority' },
  { id: 'unread', icon: 'unread', key: 'ChatHubUnread' },
  { id: 'mentions', icon: 'mention', key: 'ChatHubMentions' },
  { id: 'pinned', icon: 'pin', key: 'ChatHubPinned' },
  { id: 'private', icon: 'user', key: 'ChatHubPrivate' },
  { id: 'groups', icon: 'group', key: 'ChatHubGroups' },
  { id: 'channels', icon: 'channel', key: 'ChatHubChannels' },
  { id: 'bots', icon: 'bots', key: 'ChatHubBots' },
];

const ChatHubSidebar = ({ hub }: OwnProps) => {
  const lang = useLang();
  const isAllAccounts = hub.selectedAccountIds.length === 0;

  return (
    <aside className={styles.sidebar}>
      <div className={buildClassName(styles.sidebarScroll, 'custom-scroll')}>
        <div className={styles.section}>
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={buildClassName(
                styles.filterButton,
                hub.filter === item.id && !hub.selectedFolderKey && styles.activeFilter,
              )}
              onClick={() => hub.setFilter(item.id)}
            >
              <Icon name={item.icon} className={styles.filterIcon} />
              <span className={styles.filterLabel}>{lang(item.key)}</span>
            </button>
          ))}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>{lang('ChatHubAccounts')}</div>
          <button
            type="button"
            className={buildClassName(styles.accountButton, isAllAccounts && styles.activeAccount)}
            onClick={() => hub.setSelectedAccountIds([])}
          >
            <Icon name="forums" className={styles.filterIcon} />
            <span className={styles.accountName}>{lang('ChatHubAllAccounts')}</span>
          </button>
          {hub.accounts.map((account) => {
            const isActive = hub.selectedAccountIds.includes(account.accountId);
            const statusKey = account.isConnecting
              ? 'ChatHubConnecting'
              : (account.isOffline ? 'ChatHubOffline' : undefined);
            return (
              <button
                key={account.accountId}
                type="button"
                className={buildClassName(styles.accountButton, isActive && styles.activeAccount)}
                onClick={() => hub.toggleAccount(account.accountId)}
              >
                <Icon name="user" className={styles.filterIcon} />
                <span className={styles.accountName}>{account.name}</span>
                {statusKey && <span className={styles.status}>{lang(statusKey)}</span>}
              </button>
            );
          })}
        </div>

        {hub.settings.showFolders && Boolean(hub.folders.length) && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>{lang('ChatHubFolders')}</div>
            {hub.folders.map((folder) => (
              <button
                key={folder.key}
                type="button"
                className={buildClassName(
                  styles.folderButton,
                  hub.selectedFolderKey === folder.key && styles.activeFolder,
                )}
                onClick={() => hub.setSelectedFolderKey(
                  hub.selectedFolderKey === folder.key ? undefined : folder.key,
                )}
              >
                <Icon name="folder" className={styles.filterIcon} />
                <span className={styles.folderTitle}>{folder.title}</span>
                <span className={styles.folderMeta}>{folder.accountName}</span>
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          className={styles.filterButton}
          onClick={hub.openSettings}
        >
          <Icon name="settings" className={styles.filterIcon} />
          <span className={styles.filterLabel}>{lang('ChatHubSettings')}</span>
        </button>
      </div>
    </aside>
  );
};

export default memo(ChatHubSidebar);
