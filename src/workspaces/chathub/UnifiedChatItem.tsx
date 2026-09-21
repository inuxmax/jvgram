import { memo, useMemo } from '../../lib/teact/teact';

import type { ApiChat } from '../../api/types';
import type { MenuItemContextAction } from '../../components/ui/ListItem';
import type { ChatHubController } from '../../hooks/useChatHub';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { UnifiedChat } from '../../util/chatHub';

import buildClassName from '../../util/buildClassName';
import { formatPastTimeShort } from '../../util/dates/oldDateFormat';
import { compact } from '../../util/iteratees';
import renderText from '../../components/common/helpers/renderText';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import Avatar from '../../components/common/Avatar';
import FullNameTitle from '../../components/common/FullNameTitle';
import Icon from '../../components/common/icons/Icon';
import ListItem from '../../components/ui/ListItem';

import '../../components/common/LastMessageMeta.scss';
import styles from './ChatHub.module.scss';

type OwnProps = {
  chat: UnifiedChat;
  hub: ChatHubController;
  offsetTop: number;
  rowHeight: number;
  observeIntersection?: ObserveFn;
};

const UnifiedChatItem = ({
  chat, hub, offsetTop, rowHeight, observeIntersection,
}: OwnProps) => {
  const lang = useLang();
  const oldLang = useOldLang();
  const isPriority = hub.priorityKeys.includes(chat.key);
  const hasUnread = hub.settings.showUnreadCount && (chat.unreadCount > 0 || chat.mentionCount > 0);

  const titlePeer = useMemo(() => ({
    isCustomPeer: true as const,
    title: chat.title,
    peerColorId: chat.colorIndex,
    emojiStatusId: chat.emojiStatusId,
  }), [chat.colorIndex, chat.emojiStatusId, chat.title]);

  const avatarPeer = useMemo(() => {
    if (!chat.avatarPhotoId) return titlePeer;

    let type: ApiChat['type'] = 'chatTypePrivate';
    if (chat.type === 'channel') {
      type = 'chatTypeChannel';
    } else if (chat.type === 'group') {
      type = 'chatTypeSuperGroup';
    }

    return {
      id: chat.chatId,
      title: chat.title,
      type,
      avatarPhotoId: chat.avatarPhotoId,
    } satisfies ApiChat;
  }, [chat.avatarPhotoId, chat.chatId, chat.title, chat.type, titlePeer]);

  const handleClick = useLastCallback(() => {
    hub.selectChat(chat);
  });

  const contextActions = useMemo(() => compact([
    {
      title: lang('ChatHubOpenInTelegram'),
      icon: 'arrow-right',
      handler: () => hub.openInTelegram(chat),
    },
    {
      title: isPriority ? lang('ChatHubPriorityRemove') : lang('ChatHubPriorityAdd'),
      icon: 'star',
      handler: () => hub.togglePriority(chat),
    },
  ] satisfies Array<MenuItemContextAction | false | undefined>), [
    chat, hub, isPriority, lang,
  ]);

  const time = chat.lastMessageDate
    ? formatPastTimeShort(oldLang, chat.lastMessageDate * 1000)
    : undefined;
  const preview = hub.settings.showAccountName && !hub.settings.showAccountBadge
    ? [chat.lastMessagePreview, chat.accountName].filter(Boolean).join(' · ')
    : (chat.lastMessagePreview || '');
  const chatClassName = buildClassName(
    'Chat',
    'chat-item-clickable',
    'standalone',
    chat.type === 'private' ? 'private' : 'group',
    hub.selectedChatKey === chat.key && 'selected',
    styles.chatItem,
  );

  return (
    <ListItem
      className={chatClassName}
      style={`top: ${offsetTop}px; height: ${rowHeight}px`}
      contextActions={contextActions}
      onClick={handleClick}
    >
      <div className="status">
        <div className="avatar-wrapper">
          <Avatar peer={avatarPeer} size="large" text={chat.title} />
        </div>
      </div>
      <div className="info">
        <div className="info-row">
          <FullNameTitle
            peer={titlePeer}
            withEmojiStatus
            observeIntersection={observeIntersection}
          />
          {hub.settings.showAccountBadge && Boolean(chat.accountName) && (
            <span className="chat-account-badge">{chat.accountName}</span>
          )}
          {chat.isMuted && <Icon name="muted" />}
          <div className="separator" />
          {time && (
            <div className="LastMessageMeta">
              <span className="time">{time}</span>
            </div>
          )}
        </div>
        <div className="subtitle">
          <span className={styles.otherPreview}>{renderText(preview)}</span>
          {hasUnread && (
            <span className={styles.unreadBadge}>
              {chat.mentionCount > 0 ? chat.mentionCount : chat.unreadCount}
            </span>
          )}
          {!hasUnread && chat.isPinned && (
            <Icon name="pinned-chat" className={styles.pinBadge} />
          )}
        </div>
      </div>
    </ListItem>
  );
};

export default memo(UnifiedChatItem);
