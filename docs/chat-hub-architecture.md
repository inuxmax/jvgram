# ChatHub workspace

ChatHub is a separate application workspace inside the same Telegram Air / Tauri window. It is not a Telegram folder, filter, tab, modal, or overlay-on-the-chat-list. Telegram Web A stays the source of truth for chats, messages, media, and sessions.

## Workspace architecture

```text
Tauri window
└── App
    └── Main (logged-in)
        ├── ChatHub left island     (replaces Folders + LeftColumn)
        └── Telegram workspace      (Middle + Right stay visible)
```

Switching workspace is application navigation only. It must not:

- log out
- restart GramJS / TDLib
- open a second Telegram connection
- copy Telegram data into MongoDB
- introduce Redis

## Routes

Telegram Web A is a hash SPA (`#chatId[_thread][_type]`) plus `?account=N` for multi-account slots. There is no path router, so `/chathub` is not a real route.

| Intent | Implementation |
| --- | --- |
| Telegram workspace | Isolated store `workspace: "telegram"`. Hash continues to encode the open chat. |
| ChatHub workspace | Isolated store `workspace: "chathub"` (`taa.chathub`). Hash is left unchanged so `MessageListHistoryHandler` does not close the current chat. |

Conceptual mapping:

```text
/          → Telegram workspace
/chathub   → ChatHub workspace (store flag, not a path)
```

## Navigation flow

1. Telegram hamburger menu → **Open ChatHub** → `chatHubStore.openChatHub()`.
2. Main keeps Folders / Left / Middle / Right mounted. Folders and LeftColumn are hidden. MiddleColumn (wallpaper, message list, composer) stays visible.
3. ChatHub renders as a `#LeftColumn`-sized island: hamburger, Search, aggregated chat rows, compose FAB.
4. Menu **Telegram** or hotkey `Ctrl+Tab` sets `workspace: "telegram"`. LeftColumn is shown again with its previous scroll state. The open chat in MiddleColumn is unchanged.
5. Opening Contacts / Settings / New Group from the hamburger or FAB leaves ChatHub so those LeftColumn screens can show.

Opening a ChatHub row keeps this window on ChatHub. Live-account chats load the native MiddleColumn. Other-account chats load that account in an embedded pane in this same window (`?account=N&workspace=telegram&embed=chathub&chat=chatId#chatId`) so the full conversation UI works without a second window.

```text
accountId + chatId
        │
        ├─ same slot  → ChatHub list + native MiddleColumn
        └─ other slot → ChatHub list + embedded Telegram pane for that account
```

## Account aggregation

ChatHub lists every Telegram session slot it can see: `account{N}` keys in localStorage, `getAccountsInfo()`, and IndexedDB keys `tt-global-state` / `tt-global-state_{N}`. Identity is the slot string (`"1"`, `"2"`, …), not Telegram `userId` and never `chatId` alone. Opening ChatHub clears account/folder filters so every slot is visible. Other slots without a cache snapshot show as offline with **Open this account to load chats**.

Unique chat key:

```text
accountId + ":" + chatId
```

## Chat aggregation

```text
Live GlobalState (current slot)
        +
IndexedDB snapshots tt-global-state / tt-global-state_{N}
        │
        ▼
buildUnifiedChatsFromGlobal
        │
        ▼
type/account/folder/search filter → pinned first, then lastMessageDate
        │
        ▼
ChatHub list (live rows reuse Chat.tsx)
```

The default view is one mixed list across accounts (not sectioned by account name). Pinned chats stay at the top; the rest sort by latest message. Live rows render the same `Chat` component as Telegram’s left list (avatars, last-message meta, unread badges, selected purple). Other-account rows use a Chat-styled fallback because that slot is not in the live store.

Live updates for the current slot come from existing `addCallback` / folder-manager callbacks. Other slots refresh when ChatHub opens and when account metadata changes. ChatHub does not poll Telegram and does not create extra GramJS clients.

## Folder aggregation

Telegram folders are never merged across accounts.

```text
folder identity = accountId + folderId
```

Two folders named “Work” on two accounts appear as two rows. Optional “All Work” aggregation is out of scope.

## Search

ChatHub search is local over the aggregated rows: title, usernames, last-message preview, account name. It does not call a second Telegram search connection.

## Realtime updates

Current-slot message/chat updates already flow through GramJS → `mtpUpdateHandler` → GlobalState. ChatHub re-reads that store. Other accounts only update after their slot has written IDB (typically when that account was used in this or another window).

## Priority integration

There is no separate Telegram “priority chats” product besides pins.

- **Pinned** filter = Telegram `orderedPinnedIds` for that account.
- **Priority** filter = ChatHub-local starred keys (`accountId:chatId`) set from the row context menu.

## Theme integration

ChatHub uses existing CSS variables. It does not introduce a second theme engine.

## Performance

The unified list uses the existing `InfiniteScroll` + `useInfiniteScroll` viewport pattern (same idea as `ChatList`, row height 72px). Filtering and sorting run on lightweight rows, not full Telegram objects.

## Settings storage

`taa.chathub` in `localStorage` holds workspace, view mode, display toggles, hotkey, and priority keys. MongoDB is not used for Telegram messages, media, sessions, or auth keys. Redis is not used.

## Files

- `src/util/chatHub.ts` — store, aggregator, settings
- `src/util/chatHub.test.ts`
- `src/hooks/useChatHub.ts`
- `src/workspaces/chathub/ChatHub.tsx`
- `src/workspaces/chathub/ChatHubHeader.tsx`
- `src/workspaces/chathub/UnifiedChatList.tsx`
- `src/workspaces/chathub/UnifiedChatItem.tsx`
- `src/workspaces/chathub/ChatHubSettingsModal.tsx`
- `src/workspaces/chathub/ChatHub.module.scss`
- `src/components/main/Main.tsx` / `Main.scss` — ChatHub island, hide Folders + LeftColumn only
- `src/components/left/main/LeftSideMenuItems.tsx` — Open ChatHub / back to Telegram
- `src/assets/localization/fallback.strings` — `ChatHub*` keys
