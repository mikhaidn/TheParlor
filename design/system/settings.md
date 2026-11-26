# Settings file

All of a player's preferences live in one small JSON document. The app saves it on the device. Players can export it to back it up, move it to another phone or computer, or share a setup with a friend ("big cards for phones"). Stats and the game in progress are kept separately and never travel with it.

## The format

```json
{
  "$schema": "parlor-settings.schema.json",
  "app": "parlor",
  "version": 1,
  "name": "Big cards for phones",
  "note": "Large corner index, four-color deck, tap to move.",
  "appearance": { "theme": "system", "deck": "parlor.deck.classic", "table": "parlor.table.baize", "cardSize": "auto", "cardStyle": "large-index", "fourColor": true, "reduceMotion": "system" },
  "play": { "input": "tap", "autoMove": "always", "hints": true, "showTimer": true, "showMoves": true, "confirmNewGame": true, "leftHanded": false },
  "freecell": { "deal": "random", "freeCells": 4, "supermoves": true }
}
```

| Key | Values | Default |
| --- | --- | --- |
| `appearance.theme` | `system` · `light` (Day) · `dark` (Night) | `system` |
| `appearance.deck`, `appearance.table` | id of an installed definition (see Content layer); unknown ids fall back to Classic / Green baize | `parlor.deck.classic`, `parlor.table.baize` |
| `appearance.cardSize` | `auto` · `small` · `medium` · `large` | `auto` |
| `appearance.cardStyle` | `classic` · `large-index` | `classic` |
| `appearance.fourColor` | `true` / `false` — diamonds `suit-blue`, clubs `suit-green` | `false` |
| `appearance.reduceMotion` | `system` · `on` · `off` | `system` |
| `play.input` | `both` · `tap` · `drag` | `both` |
| `play.autoMove` | `off` · `safe` · `always` | `safe` |
| `play.hints`, `showTimer`, `showMoves`, `confirmNewGame` | `true` / `false` | `true` |
| `play.leftHanded` | `true` / `false` | `false` |
| `freecell.deal` | `random` · `daily` · `ascending` | `random` |
| `freecell.freeCells` | `4` · `3` · `2` · `1` | `4` |
| `freecell.supermoves` | `true` / `false` | `true` |

`name` and `note` are optional and are shown when someone imports a shared file. Each new game adds its own top-level group (`klondike`, `spider`…) without touching the others.

The JSON Schema and a defaults file are in **Assets → Settings**. Host the schema next to the app and point `$schema` at its URL so editors can autocomplete and check hand-edited files.

## Rules for reading a file

Parlor reads settings files leniently, because people will hand-edit and share them:

1. **Never fail the whole file.** Each valid key is applied. Invalid or unknown keys are skipped and counted ("Imported 14 settings. Skipped 1 unknown or invalid.").
2. **Missing keys keep defaults.** A file with only `{"app":"parlor","version":1,"appearance":{"fourColor":true}}` is a valid one-setting preset.
3. **Versions only go up.** A newer `version` still imports. Keys this build doesn't know are skipped, with a note.
4. **Settings only.** Import never changes stats, streaks, unlocked deals or a game in progress.
5. **Size cap 64 KB.** Anything bigger isn't a settings file.

In code: `Parlor.settings.validate(textOrObject)` returns `{ settings, applied, ignored, warnings }`. `apply(settings)` sets `data-theme`, `data-card-size`, `data-hand` and the `pl-4c` / `pl-large-index` / `pl-reduce-motion` classes on `<html>`. `save` / `load` use `localStorage` key `parlor.settings.v1`. `exportFile` opens the share sheet where files can be shared (phones), otherwise it downloads.

## Adding a setting

Add one row to `Parlor.settings.schema`, with key, label, help, type (`toggle` or `choice`), options and default. The settings panel, the validator and the exported file pick it up. Regenerate the JSON Schema file from the same list. Don't rename or remove keys: deprecate them (ignore on read) so older shared files still import.
