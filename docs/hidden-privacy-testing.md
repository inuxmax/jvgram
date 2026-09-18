# Hidden privacy — testing

Run:

```bash
npm test -- src/util/privacyVault.test.ts
```

Client typecheck after UI changes:

```bash
npx tsc --noEmit
```

## Covered in `privacyVault.test.ts`

### Hidden chat

- hide / unhide
- disappears from `getVisibleChats` / `filterHiddenChatIds`
- original chat array is not mutated (Telegram data remains)
- omitted from `filterHiddenSearchResults` when `hideFromSearch`
- `shouldSuppressNotification` / `shouldHideNotificationPreview`
- vault list still contains the id after hide (access after unlock)

### Hidden account

- hide / unhide
- omitted from `getVisibleAccountIds`
- hide does not clear other hidden chats (session is not destroyed in this layer)
- appears in `getHiddenAccounts`
- remains hidden after `lockVault`

### PIN

- create
- correct unlock
- incorrect unlock fails
- brute-force lockout
- change
- remove
- persisted state does not contain the PIN string

### Auto lock

- locks after timeout
- activity resets timeout
- lock clears `isVaultUnlocked` (hidden UI must close)

### Panic

- `triggerPanicLock` locks and closes vault UI

### Security

- PIN never in persisted JSON
- hide/unhide/unlock paths do not `console.log` the PIN or a chat title
- no `fetch` / backend calls from hide/unhide/PIN helpers

## Manual checks (Tauri / localhost:1234)

- Existing Telegram login and messaging still work.
- Hide a chat from the list context menu; it leaves the list; messages are still in Telegram if unhidden.
- Hidden chat does not appear in left search when “hide from search” is on.
- A message in a hidden chat does not produce a desktop notification when that setting is on.
- Hide an account from the account menu; it leaves the switcher; the slot is still logged in.
- Vault PIN, auto-lock, and `Ctrl+Shift+H` panic lock.
- Restart the app: vault starts locked; hidden IDs persist.
