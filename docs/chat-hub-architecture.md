# ChatHub workspace

ChatHub is a separate application workspace inside the same Telegram Air / Tauri window. It is not a Telegram folder, filter, tab, modal, drawer, or overlay-on-the-chat-list. The existing Telegram Web A layout stays the source of truth for chats, messages, media, and sessions.

## Workspace architecture

```text
Tauri window
└── App
    └── Main (logged-in)
        ├── Telegram workspace   (existing Web A columns; remains mounted)
        └── ChatHub workspace    (own header / sidebar / unified list)
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
2. Main keeps Folders / Left / Middle / Right mounted and hides them (`display: none` + `inert`).
3. ChatHub layout renders on top of `#Main`.
4. ChatHub **← Telegram** or the workspace switcher sets `workspace: "telegram"`. Telegram columns are shown again with their previous chat, draft, and scroll state.
5. Configurable hotkey (default `Ctrl+Shift+U`) toggles the two workspaces. `Ctrl+Shift+H` remains the Hidden Vault panic key and is not reused.

Opening a chat from ChatHub:

```text
accountId + chatId
        │
        ├─ same slot  → close ChatHub, openChat({ id })
        └─ other slot → set workspace telegram, navigate getAccountSlotUrl(slot)#chatId
```

Other-account open requires a slot navigation because only one `GlobalState` is live per process. Same-account open never reloads.

## Account aggregation

`getAccountsInfo()` lists session slots. ChatHub identity is the slot string (`"1"`, `"2"`, …), not Telegram `userId` and never `chatId` alone.

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
privacy filter → type/account/folder/search filter → sort by lastMessageDate
        │
        ▼
ChatHub UI
```

Each `UnifiedChat` is a lightweight row: title, type, preview, unread/mention counts, pin/mute flags, account badge. Full `ApiChat` / `ApiMessage` objects stay in Telegram stores.

Live updates for the current slot come from existing `addCallback` / folder-manager callbacks. Other slots refresh when ChatHub opens and when account metadata changes. ChatHub does not poll Telegram and does not create extra GramJS clients.

One disconnected or cache-missing account is skipped for chats and shown as Reconnecting / Offline in the sidebar. Other accounts keep working.

## Folder aggregation

Telegram folders are never merged across accounts.

```text
folder identity = accountId + folderId
```

Two folders named “Work” on two accounts appear as two rows. Optional “All Work” aggregation is out of scope.

## Search

ChatHub search is local over the aggregated rows: title, usernames, last-message preview, account name. Every result keeps its account badge. It does not call a second Telegram search connection.

## Realtime updates

Current-slot message/chat updates already flow through GramJS → `mtpUpdateHandler` → GlobalState. ChatHub re-reads that store. Other accounts only update after their slot has written IDB (typically when that account was used in this or another window).

## Privacy integration

ChatHub uses `privacyVault`:

- Hidden accounts and their chats, folders, unread, and search hits are omitted while the vault is locked.
- Hidden chats are omitted the same way.
- Unlocking the vault allows those rows in ChatHub. Telegram’s own chat list filtering is unchanged.

## Priority integration

There is no separate Telegram “priority chats” product besides pins and the Priority Gold skin.

- **Pinned** filter = Telegram `orderedPinnedIds` for that account.
- **Priority** filter = ChatHub-local starred keys (`accountId:chatId`) set from the row context menu.

## Theme integration

ChatHub uses existing CSS variables and `html.priority-gold` / `data-theme="priority-gold"`. It does not introduce a second theme engine.

## Performance

The unified list uses the existing `InfiniteScroll` + `useInfiniteScroll` viewport pattern (same idea as `ChatList`, row height 72px / 56px compact). Filtering and sorting run on lightweight rows, not full Telegram objects.

## Settings storage

`taa.chathub` in `localStorage` holds workspace, view mode, display toggles, hotkey, and priority keys. MongoDB is not used for Telegram messages, media, sessions, or auth keys. Redis is not used.

## Files to create

- `src/util/chatHub.ts` — store, aggregator, settings
- `src/util/chatHub.test.ts`
- `src/hooks/useChatHub.ts`
- `src/workspaces/WorkspaceSwitcher.tsx`
- `src/workspaces/chathub/ChatHub.tsx`
- `src/workspaces/chathub/ChatHubHeader.tsx`
- `src/workspaces/chathub/ChatHubSidebar.tsx`
- `src/workspaces/chathub/UnifiedChatList.tsx`
- `src/workspaces/chathub/UnifiedChatItem.tsx`
- `src/workspaces/chathub/ChatHubSettingsModal.tsx`
- `src/workspaces/chathub/ChatHub.module.scss`

## Files to modify

- `src/components/main/Main.tsx` / `Main.scss` — mount overlay, hide Telegram columns without unmounting
- `src/components/left/main/LeftSideMenuItems.tsx` — Open ChatHub
- `src/assets/localization/fallback.strings` — `ChatHub*` keys
