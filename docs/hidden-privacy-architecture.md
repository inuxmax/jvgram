# Hidden Accounts & Hidden Chats

Device-local UI privacy for Telegram Air (Telegram Web A + Tauri). Hidden state is a visibility layer on top of existing Telegram data. Telegram remains the source of truth for sessions, chats, and messages.

This is **not** cryptographic hiding of the Telegram cache. Hidden chat IDs remain in GramJS/IndexedDB like every other chat. The feature controls access from the application UI, search, and notifications.

## Existing architecture (audit)

| Area | Location | Extension point |
| --- | --- | --- |
| Auth / sessions | `src/lib/gramjs`, `src/api/gramjs/methods/auth.ts`, `src/util/sessions` | Unchanged. Do not store MTProto keys in privacy storage. |
| Multi-account | `src/util/multiaccount.ts` (`ACCOUNT_SLOT`, `?account=N`, `localStorage account{N}`) | `accountId` = slot number as string (`"1"`, `"2"`, …). |
| Chat list | `src/components/left/main/ChatList.tsx` via `useFolderManagerForOrderedIds` | Filter `orderedIds` after `folderManager`. Do not mutate folder source lists. |
| Chat store | `global.chats` / `folderManager.ts` | Unchanged. Hidden chats stay in Telegram state. |
| Context menu | `src/hooks/useChatContextActions.ts` | Add Hide / Unhide. |
| Search | `ChatResults.tsx`, `RecentContacts.tsx`, media/file/link/audio/message results | Filter peer IDs and `SearchResultKey`s when `hideFromSearch`. |
| Notifications | `src/util/notifications.tsx` `checkIfShouldNotify` / `getNotificationContent` | Suppress or strip preview. |
| Settings | `src/components/left/settings/SettingsPrivacy.tsx` | List item → vault modal. |
| Account switcher | `AccountMenuItems.tsx`, `AccountProfilesModal.tsx` | Filter hidden slots. |
| Keyboard | `useHotkeys` / `parseHotkey` (existing lock: `Ctrl+Shift+L`) | Panic uses a capturing window listener so it works in inputs. |
| Passcode | `src/util/passcode.ts` (`tt-passcode`, SHA-256 + AES-GCM of **session cache**) | **Do not reuse.** Vault PIN is a separate IDB store. |
| Local DB | `src/util/browser/idb.ts` (`tt-data`, `tt-passcode`) | Add `tt-privacy-vault`. Sync ID snapshot in `localStorage` for first paint. |
| UI primitives | `Modal`, `PasswordForm`, `ConfirmDialog`, `ListItem`, `Checkbox`, `RadioGroup` | Reuse. No PinInput exists. |
| Air extras | `src/util/airTranslate.ts`, `accountProfilesUi.ts` | Same isolated-store pattern. Not Zustand. Not GlobalState. |
| Tauri | `src-tauri/` | No extra Rust commands. Web Crypto + IDB is enough for PIN hashing. OS notifications already go through `notifications.tsx`. |
| Admin / Mongo | `admin/` | **Out of scope.** Hidden state is never sent to the admin API. |

## Adapted module layout

The spec’s `src/features/privacy/` tree is folded into the existing util-store + modal pattern (same as translate and profile backup):

```text
src/util/privacyVault.ts          # store, PIN hash, filters, auto-lock, panic
src/util/privacyVault.test.ts
src/hooks/usePrivacyVault.ts
src/components/left/privacy/PrivacyVaultModal.tsx
src/components/left/privacy/PrivacyVaultModal.module.scss
src/util/browser/idb.ts           # PRIVACY_IDB_STORE
```

Managers (`HiddenChatManager`, `PinManager`, …) are methods on one store so there is a single subscriber and a single persist path.

## Files modified

- `src/hooks/useFolderManager.ts` — filter ordered IDs and unread badges
- `src/hooks/useChatContextActions.ts` — Hide Chat
- `src/util/notifications.tsx` — notification protection
- `src/global/actions/ui/chats.ts` — block `processOpenChatOrThread` while locked
- Search result components under `src/components/left/search/`
- `SettingsPrivacy.tsx`, `LeftSideMenuItems.tsx`, `AccountMenuItems.tsx`, `AccountProfilesModal.tsx`, `Main.tsx`
- `src/assets/localization/fallback.strings`

## Data flow

```text
Telegram update
      ↓
GlobalState + folderManager          (unchanged)
      ↓
privacyVault.isChatHidden / filter*  (O(1) Set lookup)
      ↓
Chat list, search, unread badges, notifications, account switcher
```

```text
Hide Chat / Hide Account
      ↓
privacyVault persist (IDB + ID snapshot)
      ↓
in-memory Sets update → subscribers re-render
```

Hidden chats stay in `global.chats`. Hiding never archives, deletes, or logs out.

## Storage

Device-local only. No MongoDB, no admin API, no GramJS sync.

```text
IndexedDB tt-privacy-vault
  state: pinHash, pinSalt, failedAttempts, lockedUntil,
         autoLockMs, hideFromSearch, hideNotifications,
         hideNotificationPreview, panicHotkey,
         hiddenAccounts, hiddenChats

localStorage tt-privacy-filter
  hidden account/chat IDs + search/notification flags
  (sync first paint; no PIN)
```

`isVaultUnlocked` is **memory-only**. Restart, crash, and new windows start locked.

## Security model (summary)

- PIN: PBKDF2-SHA-256, random 16-byte salt, never stored or logged as plaintext.
- Brute-force: lockout after repeated failures.
- Telegram auth keys stay in the existing session mechanism.
- Vault lock is access control for the hidden **list**, not encryption of Telegram message bodies.
- Panic lock broadcasts a lock event to other tabs on this origin.

See `docs/hidden-privacy-security.md`.

## Implementation plan

1. Audit (this document).
2. `privacyVault` store + IDB/local snapshot + PIN helpers.
3. Hidden chats + context menu.
4. Filter `useFolderManagerForOrderedIds` (chat list).
5. Search filters.
6. Notification filters.
7. Hidden accounts + switcher.
8. Vault modal.
9. PIN create / change / remove.
10. Auto-lock idle timer.
11. Panic `Ctrl+Shift+H` (configurable).
12. Settings → Privacy entry.
13. Vitest coverage.
14. Security pass (no plaintext PIN, no backend leak, no title logs).
15. Performance pass (Sets/Maps, no full-list rebuilds beyond existing folder manager).

## Edge cases

| Case | Behavior |
| --- | --- |
| Hide open chat | Hide, then `openChat({ id: undefined })`. |
| Hide current account | Lock vault, switch to another visible slot. If none, show vault overlay (PIN required if set). |
| Logout / slot removed | Hidden IDs for missing slots are ignored; they do not recreate sessions. |
| Remote chat delete | Vault row disappears when `chats.byId` no longer has the id. Telegram data is not copied. |
| Restart while unlocked | Starts locked. |
| Sleep / resume | On `visibilitychange`, if idle exceeded auto-lock, lock. |
| Multi-tab | Lock/panic broadcasts; unlock is per-tab. |
