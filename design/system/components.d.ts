export type SuitName = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export type GameKey = 'freecell' | 'klondike' | 'spider' | 'pyramid' | 'tripeaks' | 'hearts';
export interface CardSpec { rank?: Rank; suit?: SuitName; faceDown?: boolean; hint?: boolean; disabled?: boolean }
export interface PlayingCardProps extends CardSpec { selected?: boolean; lifted?: boolean; size?: number; onClick?: (e: MouseEvent) => void }
export declare function PlayingCard(props: PlayingCardProps): HTMLDivElement;
export interface CardSlotProps { kind?: 'cell' | 'foundation' | 'tableau'; suit?: SuitName; label?: string; hint?: boolean; size?: number; ariaLabel?: string }
export declare function CardSlot(props: CardSlotProps): HTMLDivElement;
export interface PileProps { cards: CardSpec[]; fan?: 'down' | 'none'; selectedFrom?: number; emptyKind?: 'cell' | 'foundation' | 'tableau'; emptyLabel?: string; size?: number; ariaLabel?: string }
export declare function Pile(props: PileProps): HTMLDivElement;
export interface SuitProps { suit: SuitName; size?: number; label?: string; className?: string }
export declare function Suit(props: SuitProps): SVGSVGElement;
export interface ButtonProps { label: string; variant?: 'primary' | 'quiet' | 'felt'; disabled?: boolean; onClick?: (e: MouseEvent) => void }
export declare function Button(props: ButtonProps): HTMLButtonElement;
export interface GameBarProps { game?: string; deal?: string; time?: string; moves?: number; stats?: { label: string; value: string | number }[]; actions?: { label: string; onClick?: () => void; disabled?: boolean }[] }
export declare function GameBar(props: GameBarProps): HTMLDivElement;
export interface GameTileProps { game: GameKey; title?: string; meta?: string; badge?: string; onClick?: () => void }
export declare function GameTile(props: GameTileProps): HTMLButtonElement;
export interface FreeCellTableProps { deal?: number; columns?: CardSpec[][]; cells?: (CardSpec | null)[]; foundations?: { suit: SuitName; rank?: Rank }[]; selection?: { column: number; index: number }; hintCell?: number; bar?: GameBarProps | false; leftHanded?: boolean; cardSize?: 'auto' | 'small' | 'medium' | 'large' }
export declare function FreeCellTable(props: FreeCellTableProps): HTMLDivElement;
export interface SheetProps { title: string; children?: Node | Node[]; footer?: Node | Node[]; art?: Node; onClose?: (() => void) | false; className?: string }
export declare function Sheet(props: SheetProps): HTMLElement;
export declare function openSheet(sheet: HTMLElement, onClose?: () => void): () => void;
export interface RulesSheetProps { game?: GameKey; onClose?: () => void }
export declare function RulesSheet(props: RulesSheetProps): HTMLElement;
export interface WinDialogProps { title?: string; deal?: number; time?: string; moves?: number; newBest?: boolean; best?: string; streak?: number; winRate?: string; stats?: { label: string; value: string | number }[]; onDealAgain?: () => void; onReplay?: () => void; onHome?: () => void }
export declare function WinDialog(props: WinDialogProps): HTMLElement;
export interface ToggleProps { checked?: boolean; label?: string; labelledBy?: string; onChange?: (on: boolean) => void }
export declare function Toggle(props: ToggleProps): HTMLButtonElement;
export interface SegmentedProps<T = string | number> { options: [T, string][]; value?: T; label?: string; labelledBy?: string; onChange?: (value: T) => void }
export declare function Segmented(props: SegmentedProps): HTMLDivElement;
export interface ParlorSettings {
  $schema?: string; app: 'parlor'; version: 1; name?: string; note?: string;
  appearance: { theme: 'system' | 'light' | 'dark'; deck: string; table: string; cardSize: 'auto' | 'small' | 'medium' | 'large'; cardStyle: 'classic' | 'large-index'; fourColor: boolean; reduceMotion: 'system' | 'on' | 'off' };
  play: { input: 'both' | 'tap' | 'drag'; autoMove: 'off' | 'safe' | 'always'; hints: boolean; showTimer: boolean; showMoves: boolean; confirmNewGame: boolean; leftHanded: boolean };
  freecell: { deal: 'random' | 'daily' | 'ascending'; freeCells: 1 | 2 | 3 | 4; supermoves: boolean };
}
export interface SettingsResult { settings: ParlorSettings; applied: number; ignored: string[]; warnings: string[] }
export interface SettingsPanelProps { settings?: ParlorSettings; onChange?: (next: ParlorSettings) => void; onClose?: () => void }
export declare function SettingsPanel(props: SettingsPanelProps): HTMLElement;
export type Themed = string | { light: string; dark?: string };
export interface DeckDef { kind: 'deck'; id: string; version?: string; format?: number; name: string; author?: { name: string }; description?: string;
  face?: { color?: Themed; edge?: Themed }; suits?: { hearts?: Themed; diamonds?: Themed; spades?: Themed; clubs?: Themed }; fourColor?: { diamonds?: Themed; clubs?: Themed };
  index?: { font?: 'serif' | 'sans' }; court?: { style?: 'framed' | 'plain' }; corners?: 'square' | 'standard' | 'round';
  back?: { pattern?: 'lattice' | 'stripes' | 'dots' | 'plain'; color?: Themed; line?: Themed } }
export interface TableDef { kind: 'table'; id: string; version?: string; name: string; felt?: Themed; feltDeep?: Themed; feltLine?: Themed; onFelt?: Themed; onFeltMuted?: Themed; hint?: Themed; focus?: Themed }
export type ZoneKind = 'cell' | 'foundation' | 'tableau' | 'stock' | 'waste' | 'reserve';
export interface Zone { id: string; kind: ZoneKind; row: number; col: number; count: number; fan?: 'down' | 'right' | 'none'; mirror?: boolean; suits?: SuitName[]; label?: string }
export interface LayoutDef { kind: 'layout'; id: string; version?: string; name: string; columns: number; zones: Zone[] }
export type Build = 'none' | 'any' | 'down-alternate' | 'down-same-suit' | 'down-any-suit' | 'up-same-suit';
export interface ZoneRules { pickUp?: 'none' | 'top' | 'run'; run?: Build; build?: Build; empty?: 'any' | 'A' | 'K' | 'none'; capacity?: number }
export interface RulesetDef { kind: 'ruleset'; id: string; version?: string; name: string; layout: string; deal?: { method: 'numbered' | 'shuffled'; to: string; faceUp?: boolean };
  zones: Record<string, ZoneRules>; runLimit?: 'none' | 'freecell'; autoMove?: 'off' | 'safe' | 'always'; options?: Record<string, unknown> }
export interface PackDef { kind: 'pack'; id: string; version?: string; name: string; author?: { name: string }; description?: string;
  price?: { type: 'included' | 'free' | 'paid' | 'earned'; display?: string; sku?: string }; preview?: { deck?: string; table?: string; game?: GameKey };
  contents: string[]; definitions?: (DeckDef | TableDef | LayoutDef | RulesetDef)[] }
export type AnyDef = DeckDef | TableDef | LayoutDef | RulesetDef | PackDef;
export interface DefResult { def: AnyDef | null; ok: boolean; warnings: string[]; contrast: { fg: string; bg: string; theme: 'light' | 'dark'; ratio: number; need: number }[] }
export type GameState = Record<string, CardSpec[][]>;
export interface BoardProps { layout: string | LayoutDef; state: GameState; selection?: { pile: string; index: number }; hint?: string; leftHanded?: boolean; deck?: string | DeckDef; table?: string | TableDef }
export declare function Board(props: BoardProps): HTMLDivElement;
export interface DeckEditorProps { deck?: DeckDef; table?: string | TableDef; fourColor?: boolean; onChange?: (def: DeckDef) => void; onSave?: (def: DeckDef, result: DefResult) => void }
export declare function DeckEditor(props: DeckEditorProps): HTMLDivElement;
export interface PackCardProps { pack: string | PackDef; state?: 'available' | 'owned' | 'in-use'; unlock?: string; onAction?: () => void }
export declare function PackCard(props: PackCardProps): HTMLElement;
export interface ColorFieldProps { label?: string; value?: string; onChange?: (hex: string) => void }
export declare function ColorField(props: ColorFieldProps): HTMLDivElement;
declare global { interface Window { Parlor: { PlayingCard: typeof PlayingCard; CardSlot: typeof CardSlot; Pile: typeof Pile; Suit: typeof Suit; Button: typeof Button; GameBar: typeof GameBar; GameTile: typeof GameTile; render(target: Element | string, nodes: Node | Node[]): Element; games: Record<GameKey, string>;
  FreeCellTable: typeof FreeCellTable; Sheet: typeof Sheet; openSheet: typeof openSheet; RulesSheet: typeof RulesSheet; WinDialog: typeof WinDialog; SettingsPanel: typeof SettingsPanel; Toggle: typeof Toggle; Segmented: typeof Segmented;
  freecell: { deal(n: number): CardSpec[][] };
  Board: typeof Board; DeckEditor: typeof DeckEditor; PackCard: typeof PackCard; ColorField: typeof ColorField;
  defs: { format: number; validate(input: unknown): DefResult; register(input: unknown): DefResult; get(id: string): AnyDef | null; list(kind?: AnyDef['kind']): AnyDef[]; use(el: Element, refs: { deck?: string | DeckDef; table?: string | TableDef }): Element; contrast(a: string, b: string): number };
  rules: { canMove(rs: string | RulesetDef, state: GameState, from: string, index: number, to: string): { ok: boolean; reason?: string }; runCapacity(rs: RulesetDef, state: GameState, to: string): number; isWon(rs: string | RulesetDef, state: GameState): boolean; deal(rs: string | RulesetDef, n?: number): GameState };
  settings: { version: number; storageKey: string; defaults(): ParlorSettings; validate(input: unknown): SettingsResult; toJSON(s: ParlorSettings): string; load(): ParlorSettings; save(s: ParlorSettings): boolean; apply(s: ParlorSettings, root?: Element): 'light' | 'dark'; exportFile(s: ParlorSettings): Promise<'shared' | 'downloaded' | 'cancelled'>; importFile(f: File): Promise<SettingsResult> } } } }
