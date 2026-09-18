# Priority Gold — security

## Trust

- Global availability comes from Mongo via `GET /api/features`.
- Mutating the flag requires an admin session cookie. A normal user cannot `POST /api/features`.
- The client also refuses to activate Gold when the last fetched flag is false. That is UX, not the only control: hiding the radio is not sufficient by itself, which is why the apply path checks the flag.

## What is stored locally

- Skin preference (`default` | `priority-gold`)
- Wallpaper id
- Last known flag
- Optional custom wallpaper as an image data URL (jpeg/png/webp only, size-capped)

No Telegram passwords, MTProto keys, or admin JWTs.

## Custom wallpaper

- Accept `image/jpeg`, `image/png`, `image/webp` only.
- Reject other MIME types (no SVG/HTML upload as “custom wallpaper”).
- Cap file size so a huge payload cannot bloat `localStorage`.

## Fallback

If the admin API is unreachable, the last cached flag is used. That is availability cache, not a permanent client override: the next successful fetch wins.

## Theme overlay

Gold writes the same `--color-*` variables Telegram already uses. It does not inject scripts and does not change GramJS.
