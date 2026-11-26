# Design sources

Copied verbatim from the two Claude Design artifacts this repo implements. Treat them as the spec; the running app lives in `site/`.

| Folder | Artifact | What it is |
| --- | --- | --- |
| `system/` | **Parlor** design system | Principles, voice, color, type, card anatomy, PWA checklist (`pwa.md`), content layer (`content-model.md`), settings file (`settings.md`), component API (`components.d.ts`). |
| `tokens.json` | Parlor design system | Every color / type / spacing / radius / card / shadow / layout token. `tools/build.mjs` turns it into `site/parlor/tokens.css`. |
| `daily/` | **Parlor Daily — MVP** canvas | Four screens: Today (`Main`), Solved (`Result`), Share card (`Share`), Launch metrics (`Metrics`). These `.dc.html` files only render inside Claude Design; open the artifact to view them. |

The component bundle (`site/parlor/bundle.js`, `bundle.css`) is the design system's own build, unmodified. To pick up a new version, copy the new `bundle.js` / `bundle.css` / `tokens.json` over these and run `node tools/build.mjs`.

## Where each design lands in the app

| Design | Implemented in |
| --- | --- |
| Launcher (GameTile grid) | `site/index.html`, `site/js/launcher.js` |
| FreeCell table, GameBar, WinDialog, Sheets, Settings, Rules | `site/freecell/`, `site/js/table.js` (rendering + input), `site/js/engine.js` (rules) |
| Daily — Today | `site/daily/` → `today()` in `site/js/daily-page.js` |
| Daily — Solved + share grid | `result()` in `site/js/daily-page.js`, grid from `shareGrid()` in `site/js/daily.js` |
| Daily — Share card | `site/js/share.js` (canvas PNG + text fallback) |
| Daily — Launch metrics | Event names/fields in `site/js/analytics.js` (queued on-device only; no backend yet) |
| PWA checklist | `site/manifest.webmanifest`, `site/sw.js`, `site/js/pwa.js` |
