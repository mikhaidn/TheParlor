# Content layer

Everything a player can customize, an editor can make, or the shop can sell is a **definition**: a small, versioned JSON document. Components render from definitions, and the built-in look and FreeCell itself are definitions too (`parlor.core`). Editors, the shop and new games are therefore all the same work: produce or consume definitions. Nobody writes a component for a new deck or a new FreeCell variant.

```
pack ─┬─ deck      how cards look            → PlayingCard, Pile, Board
      ├─ table     how the felt looks         → Board, GameBar, sheets' art
      ├─ layout    where piles sit            → Board
      └─ ruleset   how cards may move         → rules engine (canMove, deal, isWon)
                   (points at one layout)
```

| Kind | Made by | Sold as | Example |
| --- | --- | --- | --- |
| `deck` | Card editor | Deck skin | Midnight, Parchment, Gilded |
| `table` | Table editor (a reduced card editor) | Felt | Midnight felt |
| `layout` | Board editor | Usually bundled with a ruleset | `parlor.layout.freecell` |
| `ruleset` | Game editor | Variant | Baker's Game (FreeCell layout, build by suit) |
| `pack` | Publishing step | Shop item | any of the above, one or many |

## Shared envelope

Every definition has the same header:

```json
{ "kind": "deck", "id": "parlor.deck.midnight", "format": 1, "version": "1.0.0",
  "name": "Midnight", "author": { "name": "Parlor" }, "description": "…" }
```

- **`id`** is globally unique and never reused: lowercase, dots and dashes, reverse-domain style. `parlor.*` is first-party. Player-made content gets `my.<kind>.<random>` locally and `u.<handle>.<slug>` when published.
- **`format`** is the schema version (1 today). **`version`** is the content's own semver. A newer file still loads; unknown fields are skipped with a note.
- Colors are `"#hex"` (both themes) or `{ "light": "#hex", "dark": "#hex" }`.
- Reading is lenient, like the settings file: invalid fields fall back to defaults with a warning; only a missing `kind` or `id` rejects a file. `Parlor.defs.validate(json)` returns `{ def, ok, warnings, contrast }`.

## deck

```json
{ "kind": "deck", "id": "parlor.deck.midnight", "name": "Midnight",
  "face": { "color": "#f7f3ea", "edge": "#d4cbb8" },
  "suits": { "hearts": "#a3262a", "diamonds": "#a3262a", "spades": "#14213d", "clubs": "#14213d" },
  "fourColor": { "diamonds": "#1a5aa8", "clubs": "#0f5a2c" },
  "index": { "font": "serif" }, "court": { "style": "plain" }, "corners": "round",
  "back": { "pattern": "dots", "color": "#1c2e4a", "line": "#c9a24a" } }
```

Fields map one-to-one onto the card's CSS variables (`--card-face`, `--suit-hearts`, `--card-back`, `--card-back-image`, `--card-font`, `--court-border`, `--card-radius`…), so a deck is applied by scoping, not by re-rendering: `data-deck="parlor.deck.midnight"` on any element dresses everything inside it. That is how the shop shows five decks side by side.

Deliberately not in v1: custom court art, custom pip layouts, uploaded images. They are the obvious next fields (`court.art`, `back.image`: asset references) and will need moderation before the shop takes them.

## table

`felt`, `feltDeep`, `feltLine`, `onFelt`, `onFeltMuted`, `hint`, `focus`, the same roles as the system's tokens of those names. Applied with `data-table="id"`.

## layout

A grid measured in **card columns**. Zones are runs of piles:

```json
{ "kind": "layout", "id": "parlor.layout.freecell", "columns": 8, "zones": [
  { "id": "cell",       "kind": "cell",       "row": 1, "col": 1, "count": 4, "mirror": true },
  { "id": "foundation", "kind": "foundation", "row": 1, "col": 5, "count": 4, "mirror": true, "suits": ["spades","hearts","diamonds","clubs"] },
  { "id": "tableau",    "kind": "tableau",    "row": 2, "col": 1, "count": 8, "fan": "down" } ] }
```

Zone kinds: `cell`, `foundation`, `tableau`, `stock`, `waste`, `reserve`. `fan` is `down`, `right` or `none`. `mirror` zones swap sides for left-handed play. Because positions are in card columns rather than pixels, every layout scales from phone to desktop with no extra work; Board computes card width from `columns`.

## ruleset

Rules are a small vocabulary applied per zone, not code. That keeps them safe to share and simple to edit.

```json
{ "kind": "ruleset", "id": "parlor.rules.freecell", "layout": "parlor.layout.freecell",
  "deal": { "method": "numbered", "to": "tableau", "faceUp": true },
  "zones": {
    "cell":       { "pickUp": "top",  "build": "none", "empty": "any", "capacity": 1 },
    "foundation": { "pickUp": "none", "build": "up-same-suit", "empty": "A" },
    "tableau":    { "pickUp": "run",  "run": "down-alternate", "build": "down-alternate", "empty": "any" } },
  "runLimit": "freecell", "autoMove": "safe" }
```

| Field | Values |
| --- | --- |
| `pickUp` | `none` · `top` · `run` |
| `build` / `run` | `none` · `any` · `down-alternate` · `down-same-suit` · `down-any-suit` · `up-same-suit` |
| `empty` | `any` · `A` · `K` · `none` |
| `capacity` | a number (free cells are 1) |
| `runLimit` | `none` · `freecell` (runs limited to (free cells + 1) × 2^empty columns) |
| `deal.method` | `numbered` (classic FreeCell numbering) · `shuffled` |

`Parlor.rules.canMove(ruleset, state, from, index, to)` answers with `{ ok, reason }`. The reason is written for players ("Only 4 cards can move with the free space you have."), so the game can show it directly. `rules.deal` and `rules.isWon` complete the loop. Baker's Game is FreeCell with two words changed (`down-alternate` → `down-same-suit`). Eight Off, Seahaven Towers and Forecell are the same vocabulary with different layouts. Klondike and Spider need two more fields (`stock.draw`, `complete: "K-A same suit"`), which is the next vocabulary addition.

## pack

The unit of sale and sharing:

```json
{ "kind": "pack", "id": "parlor.pack.midnight", "name": "Midnight",
  "price": { "type": "paid", "sku": "parlor.pack.midnight", "display": "$1.99" },
  "preview": { "deck": "parlor.deck.midnight", "table": "parlor.table.midnight" },
  "contents": ["parlor.deck.midnight", "parlor.table.midnight"],
  "definitions": [ { "kind": "deck", … }, { "kind": "table", … } ] }
```

`price.type` is `included`, `free`, `paid` (with `sku` for the platform store and a `display` string) or `earned` (unlocked by play). **A pack file never grants ownership:** the app asks the store, or its own achievement record, using the `sku` or `id`. Players can import a paid pack's JSON and still see it as locked.

## Quality gates

Every deck and table passes the same contrast checks the system uses (`Parlor.defs.checkContrast`): each suit on the face at 4.5:1, text on felt at 4.5:1, slot outlines, hint and focus on felt at 3:1, in both themes. Editors show failures live. Importing warns. **The shop rejects** any pack with a failure. Rulesets must deal every card and reach `isWon`, which a solver check can confirm before listing.

## Editors

All editors share one shell: a live **stage** on felt (left, or top on phones) and a **panel** of controls (right). Each control edits exactly one field, and the stage redraws from the definition. Save registers the definition locally; Export writes JSON; Publish wraps definitions in a pack.

- **Card editor** — built (`DeckEditor`).
- **Table editor** — the same shell with the seven table colors and a sample board on stage. Contrast checks are already in the layer.
- **Board editor** — the stage is a Board with a visible column grid. Drag zones to move them, drag their right edge to change `count`, and a side panel sets `kind`, `fan`, `mirror`, `label`. Changing `columns` re-flows the grid. The stage always shows the board at phone width and at desktop width, so creators see both.
- **Game editor** — pick a layout, then per zone choose from the vocabulary above with Segmented controls. The stage is a playable sandbox using `rules.canMove`, with the reason line under the board. A "Deal and solve" check runs before Publish.

## Where this lives on the device

Definitions are stored by `id` (IndexedDB), and installed packs are a list of ids. Settings refer to content by id only: `appearance.deck` and `appearance.table` in the settings file. A shared settings file names a deck the friend doesn't own; the app then falls back to Classic and offers the pack.
