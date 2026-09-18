import { memo } from '../../lib/teact/teact';

import type { ChatHubController } from '../../hooks/useChatHub';

import { CHAT_LIST_SLICE } from '../../config';
import buildClassName from '../../util/buildClassName';
import { CHAT_HUB_COMPACT_ROW_HEIGHT_PX, CHAT_HUB_ROW_HEIGHT_PX, groupUnifiedChats } from '../../util/chatHub';

import useInfiniteScroll from '../../hooks/useInfiniteScroll';
import useLang from '../../hooks/useLang';

import InfiniteScroll from '../../components/ui/InfiniteScroll';
import ListItem from '../../components/ui/ListItem';
import UnifiedChatItem from './UnifiedChatItem';

import styles from './ChatHub.module.scss';

type OwnProps = {
  hub: ChatHubController;
};

type ListRow =
  | { kind: 'header'; key: string; title: string }
  | { kind: 'chat'; key: string; chatId: string };

const UnifiedChatList = ({ hub }: OwnProps) => {
  const lang = useLang();
  const rowHeight = hub.settings.compactMode ? CHAT_HUB_COMPACT_ROW_HEIGHT_PX : CHAT_HUB_ROW_HEIGHT_PX;
  const isGrouped = hub.settings.viewMode === 'grouped';

  const rows: ListRow[] = isGrouped
    ? groupUnifiedChats(hub.chats).flatMap((group) => [
      { kind: 'header' as const, key: `header:${group.accountId}`, title: group.accountName },
      ...group.chats.map((chat) => ({ kind: 'chat' as const, key: chat.key, chatId: chat.chatId })),
    ])
    : hub.chats.map((chat) => ({ kind: 'chat' as const, key: chat.key, chatId: chat.chatId }));

  const rowKeys = rows.map((row) => row.key);
  const chatsByKey = new Map(hub.chats.map((chat) => [chat.key, chat]));
  const [viewportIds, getMore] = useInfiniteScroll(undefined, rowKeys, undefined, CHAT_LIST_SLICE);
  const viewportOffset = viewportIds?.length ? rowKeys.indexOf(viewportIds[0]) : 0;

  return (
    <section className={styles.listPane}>
      <div className={styles.viewToggle}>
        <button
          type="button"
          className={buildClassName(styles.viewButton, !isGrouped && styles.viewButtonActive)}
          onClick={() => hub.patchSettings({ viewMode: 'unified' })}
        >
          {lang('ChatHubViewUnified')}
        </button>
        <button
          type="button"
          className={buildClassName(styles.viewButton, isGrouped && styles.viewButtonActive)}
          onClick={() => hub.patchSettings({ viewMode: 'grouped' })}
        >
          {lang('ChatHubViewGrouped')}
        </button>
      </div>
      {!rows.length && (
        <div className={styles.empty}>
          {lang(hub.searchQuery.trim() ? 'ChatHubEmptySearch' : 'ChatHubEmpty')}
        </div>
      )}
      {Boolean(rows.length) && (
        <InfiniteScroll
          className={buildClassName(styles.chatList, 'custom-scroll')}
          items={viewportIds}
          preloadBackwards={CHAT_LIST_SLICE}
          withAbsolutePositioning
          maxHeight={rows.length * rowHeight}
          onLoadMore={getMore}
        >
          {viewportIds?.map((rowKey, index) => {
            const row = rows[viewportOffset + index];
            if (!row || row.key !== rowKey) return undefined;
            const offsetTop = (viewportOffset + index) * rowHeight;
            if (row.kind === 'header') {
              return (
                <ListItem
                  key={row.key}
                  className={styles.groupHeader}
                  style={`top: ${offsetTop}px; height: ${rowHeight}px`}
                  inactive
                  isStatic
                >
                  {row.title}
                </ListItem>
              );
            }

            const chat = chatsByKey.get(row.key);
            if (!chat) return undefined;
            return (
              <UnifiedChatItem
                key={chat.key}
                chat={chat}
                hub={hub}
                offsetTop={offsetTop}
                rowHeight={rowHeight}
              />
            );
          })}
        </InfiniteScroll>
      )}
    </section>
  );
};

export default memo(UnifiedChatList);
