import { memo, useEffect, useMemo, useRef } from '../../lib/teact/teact';

import type { GlobalState } from '../../global/types';
import type { ChatHubController } from '../../hooks/useChatHub';

import { CHAT_HEIGHT_PX, CHAT_LIST_SLICE } from '../../config';
import { selectCurrentMessageList, selectIsForumPanelOpen } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { getCurrentChatHubAccountId } from '../../util/chatHub';
import ensureCustomEmoji from '../../util/emoji/ensureCustomEmoji';
import { ChatAnimationTypes } from '../../components/left/main/hooks';

import useSelector from '../../hooks/data/useSelector';
import useInfiniteScroll from '../../hooks/useInfiniteScroll';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import useLang from '../../hooks/useLang';

import Chat from '../../components/left/main/Chat';
import InfiniteScroll from '../../components/ui/InfiniteScroll';
import UnifiedChatItem from './UnifiedChatItem';

import '../../components/left/main/Chat.scss';
import styles from './ChatHub.module.scss';

type OwnProps = {
  hub: ChatHubController;
};

function selectChatListChatId(global: GlobalState) {
  return selectCurrentMessageList(global)?.chatId;
}

const INTERSECTION_THROTTLE = 200;

const UnifiedChatList = ({ hub }: OwnProps) => {
  const lang = useLang();
  const containerRef = useRef<HTMLDivElement>();
  const currentChatId = useSelector(selectChatListChatId);
  const isForumPanelOpen = useSelector(selectIsForumPanelOpen);
  const chats = hub.chats;
  const rowKeys = useMemo(() => chats.map((chat) => chat.key), [chats]);
  const chatsByKey = useMemo(() => new Map(chats.map((chat) => [chat.key, chat])), [chats]);
  const [viewportIds, getMore] = useInfiniteScroll(undefined, rowKeys, undefined, CHAT_LIST_SLICE);
  const viewportOffset = viewportIds?.length ? rowKeys.indexOf(viewportIds[0]) : 0;
  const liveAccountId = getCurrentChatHubAccountId();
  const selectedIndex = chats.findIndex((chat) => (
    hub.selectedChatKey
      ? chat.key === hub.selectedChatKey
      : chat.isLive && chat.accountId === liveAccountId && chat.chatId === currentChatId
  ));
  const indicatorTop = selectedIndex >= 0 ? selectedIndex * CHAT_HEIGHT_PX : undefined;
  const { observe } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE,
  });

  useEffect(() => {
    if (!viewportIds) return;

    const visibleKeys = new Set(viewportIds);
    chats.forEach((chat) => {
      if (visibleKeys.has(chat.key) && chat.emojiStatusId) {
        ensureCustomEmoji(chat.emojiStatusId);
      }
    });
  }, [chats, viewportIds]);

  return (
    <section className={styles.listPane}>
      {!chats.length && (
        <div className={styles.empty}>
          {lang(hub.searchQuery.trim() ? 'ChatHubEmptySearch' : 'ChatHubEmpty')}
        </div>
      )}
      {Boolean(chats.length) && (
        <InfiniteScroll
          ref={containerRef}
          className={buildClassName(
            styles.chatList,
            'chat-list',
            'custom-scroll',
            isForumPanelOpen && 'forum-panel-open',
          )}
          items={viewportIds}
          itemSelector=".ListItem"
          preloadBackwards={CHAT_LIST_SLICE}
          withAbsolutePositioning
          noFastList
          maxHeight={chats.length * CHAT_HEIGHT_PX}
          onLoadMore={getMore}
        >
          <div
            key="selection-indicator"
            className={buildClassName(
              'chat-list-indicator',
              indicatorTop !== undefined && 'shown',
            )}
            style={`transform: translate3d(0, ${indicatorTop ?? 0}px, 0)`}
            aria-hidden
          />
          {viewportIds?.map((rowKey, index) => {
            const chat = chatsByKey.get(rowKey);
            const offsetTop = (viewportOffset + index) * CHAT_HEIGHT_PX;
            const rowStyle = `top: ${offsetTop}px; height: ${CHAT_HEIGHT_PX}px`;

            if (!chat) {
              return <div key={`placeholder:${rowKey}`} className={styles.liveChat} style={rowStyle} />;
            }

            if (chat.isLive) {
              return (
                <div
                  key={chat.key}
                  className={styles.liveChat}
                  style={rowStyle}
                  onMouseDownCapture={(e) => {
                    if (e.button !== 0) return;
                    hub.selectChat(chat, false);
                  }}
                  onClickCapture={() => {
                    hub.selectChat(chat, false);
                  }}
                >
                  <Chat
                    chatId={chat.chatId}
                    orderDiff={0}
                    shiftDiff={0}
                    animationType={ChatAnimationTypes.None}
                    isPinned={chat.isPinned}
                    accountLabel={hub.settings.showAccountBadge ? chat.accountName : undefined}
                    forceIsSelected={hub.selectedChatKey ? chat.key === hub.selectedChatKey : undefined}
                    className="standalone"
                    observeIntersection={observe}
                  />
                </div>
              );
            }

            return (
              <div
                key={chat.key}
                className={styles.liveChat}
                style={rowStyle}
              >
                <UnifiedChatItem
                  chat={chat}
                  hub={hub}
                  offsetTop={0}
                  rowHeight={CHAT_HEIGHT_PX}
                  observeIntersection={observe}
                />
              </div>
            );
          })}
        </InfiniteScroll>
      )}
    </section>
  );
};

export default memo(UnifiedChatList);
