# The Parlor

Classic card games with one look and one set of controls that work the same with touch, mouse, trackpad and keyboard. Installs as an app (PWA) and plays fully offline.

What's here now:

- **Launcher**: every game as a tile. FreeCell and Baker's Game are playable; Klondike, Spider, Pyramid, TriPeaks and Hearts are marked "Coming soon".
- **FreeCell**: classic Microsoft-numbered deals (Deal #617 is the same layout everywhere), with undo, hints, safe auto-moves, win stats, and a saved game that survives reloads.
- **Parlor Daily**: one FreeCell deal a day, the same for everyone and worked out from the date (Daily #1 = Nov 25, 2026). It has a streak, a week strip, a Stats calendar (past days can be played late: they count toward Solved but not the streak), a Solved screen with a share grid, and a text-first share sheet with an image option.
- **Replays**: every solve is saved as a short replay code. The share sheet can add a replay link and a QR code (opt-in). Opening someone's replay of a Daily you haven't solved shows only their result, face down: solve it first, or watch anyway and that day can't count toward your streak ("Watched first" in the calendar). The viewer steps, scrubs and plays the solve as played (undos and restarts included) or as the clean line, and "Play from here" turns any point into practice. Format: `site/js/replay-code.js` and the *Replay code v1* board in `design/daily/`.
- **Moves and help**: the move count is every card move on the board when you win, cards that went home by themselves included. Undo, hints and *Restart deal* (in the game Menu; undoable, the clock keeps running) are free and never touch the streak. The first solve is locked in; playing a deal again is practice.

Live site, once Pages is on: **https://mikhaidn.github.io/TheParlor/**

## Turn on GitHub Pages (one time)

1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to `main` (or run the **Deploy to GitHub Pages** workflow by hand). The workflow runs `tools/build.mjs` and publishes `site/`.

The site uses only relative paths, so it works under `/TheParlor/`, at a custom domain, or on `localhost`.

## Run locally

```sh
node tools/build.mjs          # regenerate tokens.css + service-worker cache list
cd site && python3 -m http.server 8000
# open http://localhost:8000/
```

No build step or dependencies are needed to *run* it: it's plain HTML, CSS and ES modules. The build script only matters when you change files, because the service worker pre-caches an exact list.

To try install/offline on a phone you need HTTPS, so use the Pages URL (or a tunnel).

## Editing the text

Every word the app shows lives in **[`site/copy/en.json`](site/copy/en.json)**, grouped by screen (`launcher`, `daily`, `calendar`, `replay`, `share`, …). `node tests/copy.test.mjs` fails if any text is added anywhere else.

- Change the words; leave `{placeholders}` as they are (`"Next deal in {time}"`).
- `one` / `other` pairs are singular and plural (`"1 day"` / `"{count} days"`).
- An empty string hides that line where the app allows it (e.g. `share.caption.short`).
- `designSystem` translates text the Parlor design system draws itself (card names, the rules sheet, settings, rule messages, the win dialog), gettext-style: `designSystem.text` maps the design system's exact English to what to show, and `designSystem.patterns` does the same for text with `{holes}` (`"{rank} of {suit}"`). Keep the keys as they are; change the values.
- `pages` holds page titles, descriptions and the 404 page; HTML gets them through `data-copy="key"` (text) and `data-copy-<attr>="key"` (attributes like `aria-label` or `content`).
- `app` is the installed app's name, description and shortcuts. `node tools/build.mjs` writes them into `manifest.webmanifest`.

Run `node tools/build.mjs` (or let the deploy do it) so the offline cache picks up the change.

## Controls

| | Touch | Mouse / trackpad | Keyboard |
| --- | --- | --- | --- |
| Move a card or run | Tap it, then tap where it goes, **or** drag | Click-click, **or** drag | Arrows to a pile, Enter, arrows to target, Enter |
| Send to foundation | Double-tap | Double-click | n/a |
| Undo / Hint | Bar buttons | Bar buttons | `U` / `H` (also Ctrl+Z) |
| Cancel selection | Tap the same pile | Click the same pile | `Esc` |

Players can switch to tap-only or drag-only input, plus left-handed layout, card size, large index, four-color deck, theme, auto-move and timer, in **Settings**.

**Backups:** Settings has two files. *Settings file* holds preferences. *Stats file* (`parlor-stats.json`) holds Daily results, streaks and per-game stats. Importing a stats file merges into what's on the device and never overwrites an existing Daily result, so it's safe to use when moving to a new phone, after the browser clears storage, or when the site moves to a new domain.

## Layout

```
site/                     ← deployed as-is
  index.html              launcher
  freecell/               FreeCell / Baker's Game table   (?deal=617, ?rules=parlor.rules.bakers-game)
  daily/                  Parlor Daily: #today, #play, #solved, #stats, #day=N, #play=N, #replay (play again), #r=CODE (a shared replay)
  parlor/                 the Parlor design system: bundle.js/.css (unmodified) + generated tokens.css
  copy/en.json            all user-facing text (see Editing the text)
  js/
    strings.js            t() / tp(): loads copy/en.json, fills {placeholders}, plurals; dsText() / localize() for design-system text
    engine.js             FreeCell-family rules on top of Parlor.rules: moves, auto-moves, hints, replay
    table.js              renders FreeCellTable; pointer + keyboard input, drag ghost, undo, timer, save/resume
    daily.js              date → daily number → deal, streaks, share grid + text, watched-first days
    replay-code.js        replay code v1: action log ⇄ base64url (16 positions, one byte per move, CRC-8)
    replay-view.js        #r=CODE: the spoiler gate, "Watch without solving" confirm, the replay viewer
    share.js              share card (canvas PNG), Web Share → clipboard → download fallbacks, replay QR
    pwa.js / sw.js        install prompt, iOS hint, update-between-games, offline cache
    stats-file.js         export/import of Daily results + game stats (merge, never overwrite)
    analytics.js          launch-metrics events, queued on-device only (no network until ENDPOINT is set)
  content/                packs (decks, tables, rulesets) and settings presets as JSON definitions
  vendor/qrcode.js        qrcode-generator 1.4.4 (MIT, see LICENSE-qrcode.txt), loaded only when a QR is drawn
design/                   the design specs this implements (see design/README.md)
tools/
  build.mjs               tokens.css + sw.js cache list + version.json
  solver.js               best-first FreeCell solver (tests; checking daily deals are solvable); tableSolution() = moves as a player makes them
tests/copy.test.mjs       every word comes from en.json (JS, HTML, design-system text)
tests/replay-code.test.mjs  replay codes round-trip real Daily solves with undos and restarts
tests/e2e.py              Playwright: plays full games through the UI, checks offline + share card, shares and opens a replay
```

## Notes and next steps

- **Deal 11982** is the one unsolvable deal in 1–32000. Random deals and the daily skip it. Tooling could also run `tools/solver.js` over upcoming daily deals before they go live.
- **Daily ranking** ("faster than 68% of players"), **launch metrics** and **tips** need a backend. Events are already named and shaped per the Metrics design in `js/analytics.js`. Set `ENDPOINT` there, and `TIP_URL` in `js/daily-page.js`, when ready.
- Only the **free** packs (Parchment deck, Baker's Game) are registered. Paid and earned packs need an ownership check first (see `design/system/content-model.md`).
- **Next games**: Klondike and Spider need the two vocabulary additions named in the content model (`stock.draw`, `complete`).
