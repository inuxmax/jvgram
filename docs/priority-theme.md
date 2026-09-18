# Priority Gold — architecture

Priority Gold is a **visual skin** on Telegram Web A. It does not add a third `ThemeKey`. Light / Dark / System stay as they are. Gold overlays CSS variables after `switchTheme` writes them.

There is no NestJS, Redis, or app WebSocket. Admin is Next.js + MongoDB (`admin/`, port 3000). Feature availability is a document in the existing `settings` collection.

## Existing systems (audit)

| Area | Location | Notes |
| --- | --- | --- |
| Theme | `ThemeKey = 'light' \| 'dark'`, `switchTheme.ts`, `themes.json` | Classes `html.theme-light` / `theme-dark`. Colors are **inline** on `html`. |
| Settings | `SettingsGeneral.tsx` | Theme radios + Chat Background. No Appearance screen. |
| Wallpaper | `useChatBackground.ts`, `_patternBackground.module.scss` | Telegram / local upload. Gold wallpapers are a separate overlay so turning Gold off does not rewrite Telegram wallpaper. |
| Air extras | `airTranslate.ts`, `privacyVault.ts` | Isolated stores + `localStorage`. |
| Admin flags | none | Closest: `settings` keyed docs (`ai`, `translate`). |
| Public CORS GET | `/api/translate`, `/api/quick-replies` | Copy this pattern. |
| Auth | First registered user is admin (`createFirstAdmin`). JWT cookie. `requireApiAdmin` on mutating APIs. |
| Tauri | no palette native code | Theme stays in the webview. |

## Layout (adapted)

```text
src/util/priorityGold.ts              # store, flag fetch, apply overlay
src/util/priorityGold.test.ts
src/hooks/usePriorityGold.ts
src/styles/priorityGold.scss          # chrome not covered by --color-*
src/assets/priority-gold/*.svg
src/util/switchTheme.ts               # generic color overlay hook
src/components/left/settings/SettingsGeneral.tsx

admin/lib/types.ts + data.ts + actions.ts
admin/app/api/features/route.ts       # GET public, POST admin
admin/app/(admin)/features/page.tsx
```

Do **not** extend `ThemeKey` or `GlobalState`.

## Data flow

```text
Boot
  → load cached flag + user skin from localStorage
  → fetch GET /api/features
  → if flag && preference === priority-gold
        set html.priority-gold + color overlay
    else
        default Telegram theme

Admin disables flag (POST /api/features)
  → next client poll (or Settings open) sees enabled: false
  → skin falls back to default without logout / reconnect
```

No Redis. No WebSocket. Clients poll about once a minute and on visibility / settings open. Cached flag is used if the admin API is down.

## User preference

```ts
type AppSkin = 'default' | 'priority-gold';
type GoldWallpaperId =
  | 'default' | 'dragon-gold' | 'minimal-gold'
  | 'dark-gold' | 'gold-wave' | 'gold-pattern' | 'custom';
```

Stored in `localStorage` (`taa.priorityGold`). Custom image (if any) is a small data URL in the same payload, capped so it cannot become a script host.

## Feature flag

Mongo `settings` document `{ key: 'features', priorityGoldTheme: boolean }`.

- `GET /api/features` — public, CORS, `{ priorityGoldTheme }`
- `POST /api/features` — `requireApiAdmin`, session must exist (admins only)

Frontend `setSkin('priority-gold')` is a no-op when the flag is false.

## Wallpaper

Gold wallpapers are CSS overlays on the existing `.background` layer (`html.priority-gold`). They do not go through GramJS or S3.

## Theme switch cost

Only DOM class + CSS variables. No Telegram reconnect, no session rewrite, no cache clear.
