import { memo, useMemo } from '../../lib/teact/teact';

import type { MenuItemContextAction } from '../../components/ui/ListItem';
import type { ChatHubController } from '../../hooks/useChatHub';
import type { UnifiedChat } from '../../util/chatHub';

import buildClassName from '../../util/buildClassName';
import { formatPastTimeShort } from '../../util/dates/oldDateFormat';
import { compact } from '../../util/iteratees';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import { getPeerColorClass } from '../../hooks/usePeerColor';

import ListItem from '../../components/ui/ListItem';
import AccountBadge from './AccountBadge';

import styles from './ChatHub.module.scss';

type OwnProps = {
  chat: UnifiedChat;
  hub: ChatHubController;
  offsetTop: number;
  rowHeight: number;
};

const UnifiedChatItem = ({
  chat, hub, offsetTop, rowHeight,
}: OwnProps) => {
  const lang = useLang();
  const oldLang = useOldLang();
  const isPriority = hub.priorityKeys.includes(chat.key);

  const handleClick = useLastCallback(() => {
    hub.openChat(chat);
  });

  const contextActions = useMemo(() => compact([
    {
      title: lang('ChatHubOpenChat'),
      icon: 'arrow-right',
      handler: () => hub.openChat(chat),
    },
    chat.isLive && {
      title: lang('ChatHubMarkRead'),
      icon: 'unread',
      handler: () => hub.markRead(chat),
    },
    chat.isLive && {
      title: chat.isMuted ? lang('ChatHubUnmute') : lang('ChatHubMute'),
      icon: chat.isMuted ? 'unmute' : 'mute',
      handler: () => hub.toggleMuted(chat),
    },
    chat.isLive && {
      title: chat.isPinned ? lang('ChatHubUnpin') : lang('ChatHubPin'),
      icon: chat.isPinned ? 'unpin' : 'pin',
      handler: () => hub.togglePinned(chat),
    },
    chat.isLive && {
      title: lang('ChatHubArchive'),
      icon: 'archive',
      handler: () => hub.toggleArchived(chat),
    },
    {
      title: isPriority ? lang('ChatHubPriorityRemove') : lang('ChatHubPriorityAdd'),
      icon: 'star',
      handler: () => hub.togglePriority(chat),
    },
    {
      title: lang('ChatHubHide'),
      icon: 'lock',
      handler: () => hub.hideChat(chat),
    },
  ] satisfies Array<MenuItemContextAction | false | undefined>), [
    chat, hub, isPriority, lang,
  ]);

  const letter = (chat.title.trim()[0] || '?');
  const time = chat.lastMessageDate
    ? formatPastTimeShort(oldLang, chat.lastMessageDate * 1000)
    : undefined;

  return (
    <ListItem
      className={styles.chatItem}
      style={`top: ${offsetTop}px; height: ${rowHeight}px`}
      ripple
      contextActions={contextActions}
      onClick={handleClick}
    >
      <div className={styles.chatButton}>
        <span className={buildClassName(styles.avatar, getPeerColorClass(chat.colorIndex))}>
          {letter}
        </span>
        <div className={styles.chatBody}>
          <div className={styles.chatTop}>
            <span className={styles.title}>{chat.title}</span>
            {time && <span className={styles.time}>{time}</span>}
          </div>
          <div className={styles.chatBottom}>
            <span className={styles.preview}>{chat.lastMessagePreview || chat.accountName}</span>
            {hub.settings.showAccountBadge && <AccountBadge name={chat.accountName} />}
            {hub.settings.showUnreadCount && chat.mentionCount > 0 && (
              <span className={buildClassName(styles.badge, styles.mentionBadge)}>{chat.mentionCount}</span>
            )}
            {hub.settings.showUnreadCount && chat.unreadCount > 0 && (
              <span className={styles.badge}>{chat.unreadCount}</span>
            )}
          </div>
          {hub.settings.showAccountName && (
            <span className={styles.accountLabel}>{chat.accountName}</span>
          )}
        </div>
      </div>
    </ListItem>
  );
};

export default memo(UnifiedChatItem);
