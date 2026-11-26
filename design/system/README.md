# Parlor — design system

Parlor is a suite of classic card games — FreeCell, Klondike, Spider, Pyramid, TriPeaks and Hearts — sharing one deck, one table and one launcher. The feel is a well-kept card room: green baize, cream card stock, an oxblood back, a little brass. Calm, legible, no casino glitter.

## Principles

1. **The cards are the interface.** Everything on the table steps back so a full tableau of 52 cards reads at a glance. Chrome stays off the felt except the slim game bar.
2. **Legibility before ornament.** Corner indices are large, suits are solid silhouettes, red and black differ in lightness as well as hue. No pictorial court cards — J, Q, K are a big serif letter.
3. **One deck, many games.** Every game uses the same PlayingCard, CardSlot and Pile. Games are told apart by their name and their layout glyph, never by a new color.
4. **One accent.** Brass means *selected*, *primary* or *won*. Nothing else is brass.
5. **Content is data.** Decks, felts, board layouts and game rules are JSON definitions (see **Content layer**). The built-in look and FreeCell are definitions too, so editors, the shop and new variants all extend the same layer.

## Voice

- Short, plain, a little warm. "New game", "Undo", "Deal again", "Solved in 2:14".
- Sentence case everywhere. The only uppercase is the `label` style above stats.
- Game names are spelled as the games are known: **FreeCell** (one word, capital C), **Klondike**, **Spider**, **Pyramid**, **TriPeaks**, **Hearts**.
- FreeCell deals are numbered — show them as "Deal #11982", never "Game 11982".
- No exclamation marks except the win line ("Solved!" is allowed once).
- Don't scold. A stuck game says "No more moves" and offers Undo and New game.

## Two surfaces

| Surface | Token | Used for |
| --- | --- | --- |
| The table | `felt`, `felt-deep` | Every game screen. Text on it is `on-felt` / `on-felt-muted`. |
| Chrome | `surface`, `surface-raised` | The launcher, menus, settings, dialogs. Text on it is `ink` / `ink-muted`. |

Never put `ink` on felt or `on-felt` on surface. Each surface has its own focus ring: `focus-felt` (warm yellow, 5:1 on felt) and `focus-chrome` (ink). Focus is a 2px ring with a 2px gap.

## Color

- **Felt** is the table in both themes; Night is a deeper green, not a grey.
- **Card face** stays light in both themes (dimmed to `#e9e3d4` at night) so `suit-red` and `suit-black` work everywhere without a second deck.
- **Suit red / black** pass 5.5:1 on card-face in both themes. Players with color-vision differences still get lightness contrast (2.5:1 between the two) and four distinct silhouettes.
- **Suits outside a card** (a Hearts score line, a foundation picker in settings) use `suit-red-chrome` and `ink`, because `suit-black` disappears on the Night surface.
- **Four-color deck** (a setting): diamonds `suit-blue`, clubs `suit-green`. Green sits darker than red so the two differ in lightness, not hue alone.
- **Card back** is oxblood with a `card-back-line` lattice, inset by a card-face margin so it never melts into felt.
- **Brass** marks the selected card (a 2px ring outside the card), the primary button and the win state.
- **Hint** is a cool blue glow for hints and legal drop targets — distinct from brass selection and red suits.

## Type

Two Google-hosted families:

- **Fraunces** (`--font-display`) — suite and game titles, card indices, the court letter. Its sturdy serif numerals make "10" read as a single index.
- **Instrument Sans** (`--font-ui`) — everything else. Stats use `tabular-nums`.

Load: `https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Instrument+Sans:wght@400;600&display=swap`

## The card

- Ratio 5:7. Default `card-width` 72px × `card-height` 100px; scale from 44px (phone) to 112px. Corner radius `radius-card`.
- Corners: rank left and suit right in one strip along the top, repeated rotated 180° at the bottom, so a card fanned at `card-fan` still shows both. `card-index` style.
- Number cards and aces: one large centre pip. Courts: the rank letter in `card-court`, framed by a hairline in the suit color.
- **Large index** (a setting, recommended on phones): a bigger rank and suit in the top strip only, with the fan widened to half a card.
- States: rest (`shadow-card`), lifted while dragging (`shadow-lift`), selected (brass ring), hint (blue glow), disabled (55% opacity — e.g. Pyramid cards still covered).
- Tableau fans: `card-fan` (26px) between face-up cards, `card-fan-down` (10px) between face-down ones. Compress the fan when a column would overflow the table, never below 18px face-up.

## Layout on the table

- Top row: cells and foundations (FreeCell), stock/waste and foundations (Klondike) — `space-6` above the tableau.
- Columns are `card-width` wide with `space-3` gutters (`space-2` on phones).
- Empty positions are always drawn with CardSlot so players can see where cards may go; foundations carry a suit watermark once their suit is known.
- The game bar sits at the top of the felt on `felt-deep`: game name, deal number, time, moves, then Undo / Hint / New game.

## Motion

Cards travel, they don't teleport: 180ms ease-out to a pile, 60ms stagger when auto-completing to foundations. A win cascades the foundations once; no confetti. Respect `prefers-reduced-motion` by snapping cards into place.

## Iconography

Suits are solid single-ink SVGs in `assets/Suits` drawn on a 24px grid — the same paths the components use. UI icons, when added, should be 1.75px stroke on 24px to sit beside them.

## Screens (single player, FreeCell first)

| Screen | Built from |
| --- | --- |
| Launcher | GameTile grid on `surface` |
| FreeCell table | FreeCellTable (GameBar, CardSlot, PlayingCard, Pile) |
| How to play | RulesSheet |
| Settings | SettingsPanel (Toggle, Segmented) and the settings file |
| Solved | WinDialog |
| Confirmations | Sheet ("Leave this game?") |
| Card editor | DeckEditor (ColorField, Segmented) |
| Shop | PackCard grid on `surface` |

All sheets open over the table with `scrim` through `Parlor.openSheet`. They are centered on wide screens and bottom sheets on phones.

## Using this system

Components live in `components/bundle.js` as `window.Parlor` — plain DOM, no framework: each is a function taking props and returning an element (`Parlor.PlayingCard({rank: 'Q', suit: 'hearts'})`). Load the tokens CSS, the Google Fonts link above (self-host both families for offline play), `components/bundle.css`, then the bundle. Set `data-theme="light"` or `"dark"` on `<html>`, or let `Parlor.settings.apply(Parlor.settings.load())` do it.

`Parlor.defs` validates, registers and applies definitions (`data-deck` / `data-table` scope a look to any element). `Parlor.rules` answers `canMove`, `deal` and `isWon` for any ruleset. `Parlor.Board` renders any layout. `Parlor.freecell.deal(n)` returns classic numbered FreeCell deals. `Parlor.settings` reads, checks, applies, saves and exports the settings file (see **Settings file**). For installing on phones and desktops, see **Installable app (PWA)**.
