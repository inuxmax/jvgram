# Priority Gold — implementation plan

See `docs/priority-theme.md` for the full architecture. This file is the audit-to-build checklist.

## Decision

Skin overlay on `html` (`class="priority-gold"` + `data-theme="priority-gold"`), not a new `ThemeKey`. Admin flag lives in Mongo `settings` / `GET /api/features`. Isolated store `src/util/priorityGold.ts`.

## Phases

1. Audit (done)
2. `setThemeColorOverlay` in `switchTheme.ts` + Gold CSS variables
3. Chat/sidebar/composer polish via `priorityGold.scss` + wallpaper overlay
4. Dragon / wave / pattern SVG assets
5. Settings → General radios + wallpaper tiles
6. Admin Features page + public GET / admin POST
7. Poll for flag changes (no Redis/WS in this repo)
8. Vitest for resolve/fallback/persist
9. Contrast and reduced-motion polish
