# Installable app (PWA)

Parlor ships as one web app that installs on phones, tablets and computers and plays fully offline. A card game is a good fit: no server is needed once the files are cached. The checklist below covers what makes it work well on every device.

## 1. Manifest and icons

- Link the manifest: `<link rel="manifest" href="/manifest.webmanifest">`. A ready one is in **Assets → PWA** (`parlor.webmanifest.json`; serve it as `manifest.webmanifest`, type `application/manifest+json`).
- `display: standalone`, `orientation: any`. FreeCell works in portrait and landscape, so don't lock it.
- `theme_color` and `background_color` are `felt` (`#1f5b43`), so the splash screen and title bar match the table.
- Icons: `parlor-192.png` and `parlor-512.png` (purpose `any`), `parlor-maskable-512.png` (purpose `maskable`: art inside the central 80% so Android's circle and squircle masks don't clip it). For iOS add `<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">`; it's full-bleed because iOS rounds the corners itself.
- `shortcuts` gives a long-press menu on the home-screen icon: FreeCell, and Today's deal.

## 2. The page head

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1f5b43" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#143a2b" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Parlor">
```

`viewport-fit=cover` lets the felt run under notches and rounded corners. FreeCellTable pads itself with `env(safe-area-inset-*)`, so cards and buttons stay clear. `settings.apply` updates `theme-color` to the current felt when a player picks Day or Night.

## 3. Offline

- Register a service worker that pre-caches the app shell on install: HTML, `bundle.js`, `bundle.css`, tokens CSS, the two font files (self-host them for offline, rather than Google Fonts), and icons. Serve them cache-first, and update in the background.
- When a new version is ready, wait until the player is between games, then show "Update ready · Restart" in the launcher. Never reload mid-deal.
- No network calls during play. Daily deal numbers come from the date (e.g. days since 2026-01-01), not a server, so they work offline and match for everyone.

## 4. Never lose a game

Phones kill background apps without warning. Save the game state (deal number, move list, elapsed time) after every move. A move list is a few hundred bytes. Also save on `visibilitychange` → `hidden`. On launch, resume exactly where the player left off. Pause the timer while the app is hidden. Use `localStorage` for settings and the current game. Move stats to IndexedDB if history grows. Call `navigator.storage.persist()` after the first finished game so the browser is less likely to evict data.

## 5. Every screen size

| Width | Cards | Gutters | Notes |
| --- | --- | --- | --- |
| 320–559px (phones) | 34–62px | `space-1` | Bar actions go full-width below the stats; Large index style recommended. Sheets become bottom sheets under 520px. |
| 560–1023px (tablets, small laptops) | 62–112px | `space-3` | Bar on one line. |
| 1024px+ | capped at `card-max` (112px) | `space-3` | The table centers; felt fills the rest. |

- Card width comes from the container, not the screen. FreeCellTable does this with a container query, so it works the same inside a split-screen window or a desktop window.
- In landscape on a phone, height runs out first. When a column would run past the bottom, reduce that pile's `--card-fan` (never below 18px, or `card-fan-down` 6px).
- Respect the Card size setting by capping, not forcing: small = 56px, medium = 80px.

## 6. Touch, mouse, pen and keyboard

- Use Pointer Events for drag, so one code path handles mouse, touch and stylus. Set `touch-action: none` on cards while dragging so the page doesn't scroll. The table sets `overscroll-behavior: none`, so pull-to-refresh can't wipe a game.
- Every control reaches `tap-min` (44px) on coarse pointers. The CSS handles buttons, segmented options and the close button.
- Tap-to-move (`play.input`): the first tap selects (brass ring), the second taps the destination. Double-tap sends a card to its foundation.
- Keyboard: arrow keys move between piles, Enter or Space picks up and drops, U is undo, H is hint, Esc closes sheets. Focus rings are `focus-felt` on the table and `focus-chrome` on sheets.
- Haptics (`navigator.vibrate(8)`) on a successful drop, where supported and only if motion isn't reduced.

## 7. Platform notes

- **iOS / iPadOS:** there is no install prompt, so show a one-time hint in the launcher ("Add Parlor to your Home Screen: Share → Add to Home Screen"), and only in Safari, when not already standalone (`navigator.standalone`). Storage can be cleared if the app goes unused for weeks; the settings file export is the player's backup.
- **Android / Chromium desktop:** catch `beforeinstallprompt` and offer "Install app" in the launcher menu, never as a pop-up mid-game. `file_handlers` in the manifest let an installed Chromium desktop app open a shared `parlor-settings.json` straight into Import.
- **Detect installed mode** with `matchMedia('(display-mode: standalone)')` to hide the install hint and any browser-only links.

## 8. Before you ship

Run Lighthouse's PWA and accessibility checks. Test install and offline play on one iPhone, one Android phone and one desktop browser. Rotate mid-game, and kill and reopen the app mid-game.
