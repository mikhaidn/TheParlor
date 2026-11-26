# Design sources

Copied verbatim from the two Claude Design artifacts this repo implements. Treat them as the spec; the running app lives in `site/`.

| Folder | Artifact | What it is |
| --- | --- | --- |
| `system/` | **Parlor** design system | Principles, voice, color, type, card anatomy, PWA checklist (`pwa.md`), content layer (`content-model.md`), settings file (`settings.md`), component API (`components.d.ts`). |
| `tokens.json` | Parlor design system | Every color / type / spacing / radius / card / shadow / layout token. `tools/build.mjs` turns it into `site/parlor/tokens.css`. |
| `daily/` | **Parlor Daily — MVP** canvas | Today (`Main`), Solved (`Result`), Share card (`Share`), Launch metrics (`Metrics`), Stats & calendar (`Calendar`), text-first Share sheet (`CopyShare`); replays: Replay code v1 (`ReplaySpec`), Share the how (`ShareHow`), Opening a replay (`ReplayGate`), Replay viewer (`Replay`), Restart deal (`Restart`); proposed, not built yet: Parlor Lab (`Lab`, `LabTheme`, `LabPhone`). These `.dc.html` files only render inside Claude Design; open the artifact to view them. |

The component bundle (`site/parlor/bundle.js`, `bundle.css`) is the design system's own build, unmodified. To pick up a new version, copy the new `bundle.js` / `bundle.css` / `tokens.json` over these and run `node tools/build.mjs`.

Copy in the designs is a starting point; the app's live text is in `site/copy/en.json`.

## Where each design lands in the app

| Design | Implemented in |
| --- | --- |
| Launcher (GameTile grid) | `site/index.html`, `site/js/launcher.js` |
| FreeCell table, GameBar, WinDialog, Sheets, Settings, Rules | `site/freecell/`, `site/js/table.js` (rendering + input), `site/js/engine.js` (rules) |
| Daily — Today | `site/daily/` → `today()` in `site/js/daily-page.js` |
| Daily — Solved + share grid | `result()` in `site/js/daily-page.js`, grid from `shareGrid()` in `site/js/daily.js` |
| Daily — Share sheet (text first) | `openShare()` in `site/js/daily-page.js`; formats in `shareText()` / `SHARE_FORMAT` in `site/js/daily.js` |
| Daily — Share card | `drawShareCard()` in `site/js/share.js` (the sheet's Save image) |
| Daily — Stats & calendar | `calendar()` / `dayDetail()` in `site/js/daily-page.js`; day states from `dayStatus()` in `site/js/daily.js` |
| Daily — Launch metrics | Event names/fields in `site/js/analytics.js` (queued on-device only; no backend yet) |
| Replay code v1 | `site/js/replay-code.js`; the table's action log in `site/js/table.js` |
| Share the how | `openShare()` in `site/js/daily-page.js`, `qrSvg()` in `site/js/share.js` |
| Opening a replay, Replay viewer | `site/js/replay-view.js` |
| Restart deal | `restartDeal()` in `site/js/table.js` (Menu and the "No more moves" sheet) |
| PWA checklist | `site/manifest.webmanifest`, `site/sw.js`, `site/js/pwa.js` |
