# Hidden privacy — security

## What this feature provides

- UI privacy: hidden chats and accounts are omitted from the normal chat list, search (when enabled), account switcher, and (when enabled) OS/web notifications.
- Access control: a local PIN gates the Hidden Vault UI and opening a hidden chat while the vault is locked.
- Local PIN handling: PBKDF2-SHA-256 with a random salt, lockout after failed attempts.

## What this feature does not provide

It does **not** encrypt Telegram messages, media, or MTProto session keys. A person with access to this device’s Telegram IndexedDB, or a debugger attached to an unlocked session, can still read the same chat data Telegram Web A already stores.

Do not describe the feature as “encrypted”, “impossible to recover”, or “completely secure”.

## Threat model

| Attacker | Outcome |
| --- | --- |
| Casual shoulder-surfing / shared screen | Hidden chats and accounts stay out of the main UI. Panic lock (`Ctrl+Shift+H` by default) closes the vault immediately. |
| Someone who can unlock the OS user and open the app | Sees normal chats. Vault requires PIN if one is set. Telegram passcode (separate feature) may still lock the whole session cache. |
| Someone who can read IndexedDB / localStorage | Can see hidden **IDs** in `tt-privacy-vault` / `tt-privacy-filter`. Can see full Telegram cache (`tt-data`, gramjs). Cannot recover the PIN from `pinHash` without brute force (slowed by PBKDF2 + lockout in the app; offline hash cracking is still possible). |
| Network / admin backend | Hidden IDs, PIN, and PIN hash are not uploaded. |
| XSS on the origin | Can read IDB/localStorage like any other origin script. This is not a defense against XSS. |

## PIN

- Algorithm: Web Crypto `PBKDF2` with `SHA-256`, 100 000 iterations, 256-bit derived key, 16-byte CSPRNG salt.
- Stored: `pinHash` (hex) + `pinSalt` (hex) in IndexedDB `tt-privacy-vault`.
- Never stored: PIN plaintext, Telegram password, 2FA, MTProto/TDLib keys.
- Never logged: PIN, hidden chat titles, hidden account names.
- Memory: after verify, only `isVaultUnlocked` remains. The PIN string is not kept.
- Lockout: after 5 consecutive failures, delay starts at 30s and doubles, capped at 15 minutes.

The existing app passcode (`tt-passcode`) encrypts cached global/session JSON. The vault PIN is independent so resetting one does not silently unlock the other.

## Storage rules

- Do not write hidden state to MongoDB or `admin/` APIs.
- Do not put privacy state in `GlobalState` / `cache.ts` (that cache can be restored and synced across the app’s own mechanisms).
- Cloud sync of hidden status is **not** implemented and must stay opt-in if added later.

## Notifications

If a chat is hidden and “hide notifications” is on, `checkIfShouldNotify` returns false before title/body are built. If only preview hiding is on, title is the app name and body is the generic hidden-message string.

## Logging and analytics

`privacyVault` does not call `console.log` with PINs, titles, or account metadata. Do not add debug prints of hidden chat names.

## Tauri

No additional Rust secret store in this version. PIN hashing uses Web Crypto in the webview. OS notifications are filtered in the existing TypeScript notification helper, not in a second native pipeline.
