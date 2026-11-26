/* @ds-bundle: {"format":4,"namespace":"Parlor","components":[{"name":"PlayingCard"},{"name":"CardSlot"},{"name":"Pile"},{"name":"Suit"},{"name":"Button"},{"name":"GameBar"},{"name":"GameTile"},{"name":"FreeCellTable"},{"name":"Sheet"},{"name":"RulesSheet"},{"name":"WinDialog"},{"name":"SettingsPanel"},{"name":"Toggle"},{"name":"Segmented"},{"name":"Board"},{"name":"DeckEditor"},{"name":"PackCard"},{"name":"ColorField"}]} */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var SUITS = {
    hearts: { color: 'red', name: 'hearts', d: 'M12 21.2C11.3 20.6 2.2 14.3 2.2 8.4 2.2 5.3 4.5 3 7.4 3c2 0 3.6 1.1 4.6 2.8C13 4.1 14.6 3 16.6 3c2.9 0 5.2 2.3 5.2 5.4 0 5.9-9.1 12.2-9.8 12.8z' },
    diamonds: { color: 'red', name: 'diamonds', d: 'M12 1.8 19.6 12 12 22.2 4.4 12z' },
    spades: { color: 'black', name: 'spades', d: 'M12 1.8c.7.6 9.8 7.1 9.8 12.6 0 2.9-2.2 5-4.9 5-1.9 0-3.3-.9-4.1-2.2.1 1.9.8 3.4 2.4 4.9H8.8c1.6-1.5 2.3-3 2.4-4.9-.8 1.3-2.2 2.2-4.1 2.2-2.7 0-4.9-2.1-4.9-5C2.2 8.9 11.3 2.4 12 1.8z' },
    clubs: { color: 'black', name: 'clubs', d: 'M12 1.8a4.6 4.6 0 0 1 3.9 7 4.6 4.6 0 1 1-2.6 8.1c.1 2 .8 3.6 2.4 5.3H8.3c1.6-1.7 2.3-3.3 2.4-5.3a4.6 4.6 0 1 1-2.6-8.1A4.6 4.6 0 0 1 12 1.8z' }
  };
  var ALIAS = { h: 'hearts', heart: 'hearts', d: 'diamonds', diamond: 'diamonds', s: 'spades', spade: 'spades', c: 'clubs', club: 'clubs' };
  var RANK_NAMES = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' };

  function suitOf(s) { s = String(s || '').toLowerCase(); return SUITS[s] || SUITS[ALIAS[s]] || null; }
  function rankOf(r) { r = String(r == null ? '' : r).toUpperCase(); if (r === '1') r = 'A'; if (r === '11') r = 'J'; if (r === '12') r = 'Q'; if (r === '13') r = 'K'; if (r === 'T') r = '10'; return r; }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function svg(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    return e;
  }
  function setSize(node, size) {
    if (size == null) return;
    node.style.setProperty('--pl-w', typeof size === 'number' ? size + 'px' : size);
  }

  /* Suit — a solid suit silhouette. */
  function Suit(props) {
    props = props || {};
    var s = suitOf(props.suit) || SUITS.spades;
    var size = props.size == null ? 24 : props.size;
    var g = svg('svg', { viewBox: '0 0 24 24', width: size, height: size, 'class': 'pl-suit pl-' + s.color + ' pl-s-' + s.name + (props.className ? ' ' + props.className : ''), 'aria-hidden': props.label ? null : 'true', role: props.label ? 'img' : null, 'aria-label': props.label || null });
    g.appendChild(svg('path', { d: s.d }));
    return g;
  }

  /* PlayingCard — one card, face up or face down. */
  function PlayingCard(props) {
    props = props || {};
    var card = el('div', 'pl-card');
    setSize(card, props.size);
    if (props.selected) card.classList.add(props.selected === 'run' ? 'is-run' : 'is-selected');
    if (props.hint) card.classList.add('is-hint');
    if (props.disabled) card.classList.add('is-disabled');
    if (props.lifted) card.classList.add('is-lifted');
    if (props.faceDown) {
      card.classList.add('pl-down');
      card.setAttribute('role', 'img');
      card.setAttribute('aria-label', 'Face-down card');
      card.appendChild(el('span', 'pl-back'));
      return card;
    }
    var s = suitOf(props.suit) || SUITS.spades;
    var r = rankOf(props.rank || 'A');
    var court = r === 'J' || r === 'Q' || r === 'K';
    card.classList.add('pl-' + s.color, 'pl-s-' + s.name);
    card.setAttribute('role', 'img');
    card.setAttribute('aria-label', (RANK_NAMES[r] || r) + ' of ' + s.name);
    function corner(pos) {
      var c = el('span', 'pl-corner pl-corner-' + pos);
      c.appendChild(el('span', 'pl-rank', r));
      c.appendChild(Suit({ suit: s.name, size: null, className: 'pl-corner-suit' }));
      return c;
    }
    card.appendChild(corner('top'));
    var mid = el('span', court ? 'pl-mid pl-mid-court' : 'pl-mid');
    if (court) {
      var frame = el('span', 'pl-court');
      frame.appendChild(el('span', 'pl-court-letter', r));
      mid.appendChild(frame);
    } else {
      mid.appendChild(Suit({ suit: s.name, size: null, className: r === 'A' ? 'pl-pip pl-pip-ace' : 'pl-pip' }));
    }
    card.appendChild(mid);
    card.appendChild(corner('bottom'));
    if (props.onClick) { card.tabIndex = 0; card.addEventListener('click', props.onClick); }
    return card;
  }

  /* CardSlot — an empty position on the table. */
  function CardSlot(props) {
    props = props || {};
    var kind = props.kind || 'cell';
    var slot = el('div', 'pl-slot pl-slot-' + kind);
    setSize(slot, props.size);
    if (props.hint) slot.classList.add('is-hint');
    var label = props.label;
    var s = suitOf(props.suit);
    if (kind === 'foundation' && s) {
      slot.appendChild(Suit({ suit: s.name, size: null, className: 'pl-slot-suit' }));
    } else {
      if (label == null && kind === 'foundation') label = 'A';
      if (label != null) slot.appendChild(el('span', 'pl-slot-label', label));
    }
    slot.setAttribute('role', 'img');
    slot.setAttribute('aria-label', props.ariaLabel || ('Empty ' + (kind === 'cell' ? 'free cell' : kind) + (s ? ' for ' + s.name : '')));
    return slot;
  }

  /* Pile — a fanned column of cards (tableau) or a squared stack. */
  function Pile(props) {
    props = props || {};
    var cards = props.cards || [];
    var pile = el('div', 'pl-pile' + (props.fan === 'none' ? ' pl-pile-stack' : ''));
    setSize(pile, props.size);
    if (!cards.length) {
      pile.appendChild(CardSlot({ kind: props.emptyKind || 'tableau', label: props.emptyLabel, size: props.size }));
      return pile;
    }
    var sel = props.selectedFrom == null ? -1 : props.selectedFrom;
    cards.forEach(function (c, i) {
      pile.appendChild(PlayingCard({ size: props.size, rank: c.rank, suit: c.suit, faceDown: c.faceDown, hint: c.hint, disabled: c.disabled, selected: sel >= 0 && i >= sel ? (cards.length - sel > 1 ? 'run' : true) : false }));
    });
    pile.setAttribute('role', 'group');
    pile.setAttribute('aria-label', props.ariaLabel || ('Pile of ' + cards.length));
    return pile;
  }

  /* Button — chrome or table action. */
  function Button(props) {
    props = props || {};
    var b = el('button', 'pl-btn pl-btn-' + (props.variant || 'quiet'), props.label || props.children || '');
    b.type = 'button';
    if (props.disabled) b.disabled = true;
    if (props.onClick) b.addEventListener('click', props.onClick);
    return b;
  }

  /* GameBar — the strip at the top of the table. */
  function GameBar(props) {
    props = props || {};
    var bar = el('div', 'pl-bar');
    var id = el('div', 'pl-bar-id');
    id.appendChild(el('span', 'pl-bar-title', props.game || 'FreeCell'));
    if (props.deal) id.appendChild(el('span', 'pl-bar-deal', props.deal));
    bar.appendChild(id);
    var stats = el('div', 'pl-bar-stats');
    (props.stats || [{ label: 'Time', value: props.time || '0:00' }, { label: 'Moves', value: props.moves == null ? 0 : props.moves }]).forEach(function (st) {
      var s = el('div', 'pl-stat');
      s.appendChild(el('span', 'pl-stat-label', st.label));
      s.appendChild(el('span', 'pl-stat-value', String(st.value)));
      stats.appendChild(s);
    });
    bar.appendChild(stats);
    var acts = el('div', 'pl-bar-actions');
    (props.actions || [{ label: 'Undo' }, { label: 'Hint' }, { label: 'New game' }]).forEach(function (a) {
      acts.appendChild(Button({ label: a.label, variant: 'felt', onClick: a.onClick, disabled: a.disabled }));
    });
    bar.appendChild(acts);
    return bar;
  }

  /* Layout glyphs for GameTile: tiny schematic tables, 120×72. */
  var CW = 11, CH = 15;
  function r(g, x, y, w, h, cls) { g.appendChild(svg('rect', { x: x, y: y, width: w, height: h, rx: 1.5, 'class': cls })); }
  var GLYPHS = {
    freecell: function (g) {
      var x0 = 5.5, step = 14;
      for (var i = 0; i < 8; i++) r(g, x0 + i * step, 6, CW, CH, i < 4 ? 'g-slot' : 'g-slot');
      r(g, x0 + 5 * step, 6, CW, CH, 'g-card');
      var n = [6, 5, 6, 4, 6, 5, 5, 4];
      for (var c = 0; c < 8; c++) for (var k = 0; k < n[c]; k++) r(g, x0 + c * step, 27 + k * 5.5, CW, CH, 'g-card');
    },
    klondike: function (g) {
      var x0 = 5.5, step = 16, w = 13;
      r(g, x0, 6, w, CH, 'g-back'); r(g, x0 + step, 6, w, CH, 'g-card');
      for (var i = 3; i < 7; i++) r(g, x0 + i * step, 6, w, CH, 'g-slot');
      for (var c = 0; c < 7; c++) { for (var k = 0; k < c; k++) r(g, x0 + c * step, 27 + k * 3, w, CH, 'g-back'); r(g, x0 + c * step, 27 + c * 3, w, CH, 'g-card'); }
    },
    spider: function (g) {
      var x0 = 6, step = 11, w = 9;
      for (var s = 0; s < 4; s++) r(g, x0 + s * 1.6, 5, w, 13, 'g-back');
      for (var c = 0; c < 10; c++) {
        var backs = c < 4 ? 5 : 4;
        for (var k = 0; k < backs; k++) r(g, x0 + c * step, 24 + k * 3, w, 13, 'g-back');
        r(g, x0 + c * step, 24 + backs * 3, w, 13, 'g-card');
        if (c % 3 === 0) r(g, x0 + c * step, 24 + backs * 3 + 5, w, 13, 'g-card');
      }
    },
    pyramid: function (g) {
      var step = 12, cx = 60;
      for (var row = 0; row < 7; row++) for (var i = 0; i <= row; i++) r(g, cx - (row + 1) * step / 2 + i * step + 0.5, 4 + row * 7.5, CW, CH, 'g-card');
    },
    tripeaks: function (g) {
      var s = 10.6, x0 = 7, w = 9, h = 13;
      var rows = [[1.5, 4.5, 7.5], [1, 2, 4, 5, 7, 8], [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]];
      rows.forEach(function (row, ri) { row.forEach(function (p) { r(g, x0 + p * s, 6 + ri * 9, w, h, ri < 3 ? 'g-back' : 'g-card'); }); });
      r(g, 46, 54, w, h, 'g-back'); r(g, 62, 54, w, h, 'g-card');
    },
    hearts: function (g) {
      for (var i = 0; i < 7; i++) r(g, 38 + i * 6, 53, CW, CH, 'g-card');
      for (var j = 0; j < 7; j++) r(g, 38 + j * 6, 4, CW, CH, 'g-back');
      for (var k = 0; k < 4; k++) { r(g, 8, 18 + k * 7, CH, CW, 'g-back'); r(g, 97, 18 + k * 7, CH, CW, 'g-back'); }
      r(g, 46, 27, CW, CH, 'g-card'); r(g, 56, 24, CW, CH, 'g-card'); r(g, 66, 28, CW, CH, 'g-card');
    }
  };
  var GAME_NAMES = { freecell: 'FreeCell', klondike: 'Klondike', spider: 'Spider', pyramid: 'Pyramid', tripeaks: 'TriPeaks', hearts: 'Hearts' };

  /* GameTile — a game in the suite launcher. */
  function GameTile(props) {
    props = props || {};
    var key = String(props.game || 'freecell').toLowerCase();
    var tile = el('button', 'pl-tile');
    tile.type = 'button';
    var art = el('span', 'pl-tile-art');
    var g = svg('svg', { viewBox: '0 0 120 72', 'aria-hidden': 'true', 'class': 'pl-glyph' });
    (GLYPHS[key] || GLYPHS.freecell)(g);
    art.appendChild(g);
    tile.appendChild(art);
    var text = el('span', 'pl-tile-text');
    text.appendChild(el('span', 'pl-tile-title', props.title || GAME_NAMES[key] || key));
    if (props.meta) text.appendChild(el('span', 'pl-tile-meta', props.meta));
    tile.appendChild(text);
    if (props.badge) text.appendChild(el('span', 'pl-tile-badge', props.badge));
    if (props.onClick) tile.addEventListener('click', props.onClick);
    return tile;
  }

  /* ---------- FreeCell: classic numbered deals ---------- */
  /* The original Microsoft numbering (deals 1–32000 and beyond), so "Deal #617" means the same layout everywhere. */
  var FC_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var FC_SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];
  function fcDeal(n) {
    var seed = (n >>> 0) || 1;
    function rand() { seed = (seed * 214013 + 2531011) % 2147483648; return Math.floor(seed / 65536); }
    var deck = []; for (var i = 0; i < 52; i++) deck.push(i);
    var cols = [[], [], [], [], [], [], [], []];
    for (var k = 0; k < 52; k++) {
      var left = 52 - k, j = rand() % left, c = deck[j];
      deck[j] = deck[left - 1];
      cols[k % 8].push({ rank: FC_RANKS[Math.floor(c / 4)], suit: FC_SUITS[c % 4] });
    }
    return cols;
  }

  /* FreeCellTable — the whole FreeCell table: GameBar + Board with the FreeCell layout. */
  function FreeCellTable(props) {
    props = props || {};
    var root = el('div', 'pl-fc pl-tablebox');
    if (props.leftHanded) root.setAttribute('data-hand', 'left');
    if (props.cardSize) root.setAttribute('data-card-size', props.cardSize);
    if (props.bar !== false) {
      var barProps = props.bar || {};
      root.appendChild(GameBar({
        game: barProps.game || 'FreeCell',
        deal: barProps.deal || (props.deal ? 'Deal #' + props.deal : null),
        stats: barProps.stats, time: barProps.time, moves: barProps.moves,
        actions: barProps.actions || [{ label: 'Undo' }, { label: 'Hint' }, { label: 'Menu' }]
      }));
    }
    var state = props.state;
    var selection = props.selection && props.selection.pile ? props.selection : null;
    if (!state) {
      var cells = (props.cells || [null, null, null, null]).map(function (c, i) { if (c && c.selected) selection = { pile: 'cell.' + i, index: 0 }; return c ? [c] : []; });
      var fnd = (props.foundations || []).map(function (f) { return f && f.rank ? [f] : []; });
      while (fnd.length < 4) fnd.push([]);
      state = { cell: cells, foundation: fnd, tableau: props.columns || fcDeal(props.deal || 1) };
    }
    if (!selection && props.selection) selection = { pile: 'tableau.' + props.selection.column, index: props.selection.index };
    var board = Board({ layout: props.layout || 'parlor.layout.freecell', state: state, selection: selection,
      hint: props.hint || (props.hintCell != null ? 'cell.' + props.hintCell : null), leftHanded: props.leftHanded, deck: props.deck, table: props.table });
    root.appendChild(board);
    if (props.table) defUse(root, { table: props.table });
    return root;
  }

  /* ---------- Sheet: the shared dialog frame ---------- */
  function closeIcon() {
    var g = svg('svg', { viewBox: '0 0 24 24', width: 20, height: 20, 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.75', 'stroke-linecap': 'round' });
    g.appendChild(svg('path', { d: 'M6 6l12 12M18 6L6 18' }));
    return g;
  }
  var sheetId = 0;
  function Sheet(props) {
    props = props || {};
    var id = 'pl-sheet-' + (++sheetId);
    var s = el('section', 'pl-sheet' + (props.className ? ' ' + props.className : ''));
    s.setAttribute('role', 'dialog');
    s.setAttribute('aria-modal', 'true');
    s.setAttribute('aria-labelledby', id);
    if (props.art) { var art = el('div', 'pl-sheet-art'); art.appendChild(props.art); s.appendChild(art); }
    var head = el('header', 'pl-sheet-head');
    var h = el('h2', 'pl-sheet-title', props.title || ''); h.id = id;
    head.appendChild(h);
    if (props.onClose !== false) {
      var x = el('button', 'pl-icon-btn'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.appendChild(closeIcon());
      if (props.onClose) x.addEventListener('click', props.onClose);
      head.appendChild(x);
    }
    s.appendChild(head);
    var body = el('div', 'pl-sheet-body');
    [].concat(props.children || []).forEach(function (n) { if (n) body.appendChild(n); });
    s.appendChild(body);
    if (props.footer) { var foot = el('footer', 'pl-sheet-foot'); [].concat(props.footer).forEach(function (n) { if (n) foot.appendChild(n); }); s.appendChild(foot); }
    return s;
  }
  /* openSheet(sheet) — mount over a scrim; Escape or a scrim click closes. Returns close(). */
  function openSheet(sheet, onClose) {
    var scrim = el('div', 'pl-scrim');
    scrim.appendChild(sheet);
    var prev = document.activeElement;
    function close() { document.removeEventListener('keydown', onKey); scrim.remove(); if (prev && prev.focus) prev.focus(); if (onClose) onClose(); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    scrim.addEventListener('click', function (e) { if (e.target === scrim) close(); });
    document.addEventListener('keydown', onKey);
    var x = sheet.querySelector('.pl-icon-btn'); if (x) x.addEventListener('click', close);
    document.body.appendChild(scrim);
    var first = sheet.querySelector('button, [href], input, [tabindex="0"]'); if (first) first.focus();
    return close;
  }

  /* ---------- RulesSheet ---------- */
  function para(text) { return el('p', 'pl-p', text); }
  function rulesSection(title, nodes) { var s = el('div', 'pl-rules-sec'); s.appendChild(el('h3', 'pl-h3', title)); nodes.forEach(function (n) { s.appendChild(n); }); return s; }
  function list(items) { var u = el('ul', 'pl-list'); items.forEach(function (t) { u.appendChild(el('li', null, t)); }); return u; }
  function example(cards, caption) {
    var f = el('figure', 'pl-example');
    f.appendChild(Pile({ cards: cards, size: 44 }));
    f.appendChild(el('figcaption', 'pl-caption', caption));
    return f;
  }
  var RULES = {
    freecell: function () {
      var diagram = el('figure', 'pl-rules-diagram');
      var art = el('div', 'pl-rules-art');
      var g = svg('svg', { viewBox: '0 0 120 72', 'aria-hidden': 'true', 'class': 'pl-glyph' });
      GLYPHS.freecell(g); art.appendChild(g); diagram.appendChild(art);
      var keys = el('figcaption', 'pl-rules-keys');
      ['Free cells', 'Foundations', 'Tableau'].forEach(function (k) { keys.appendChild(el('span', null, k)); });
      diagram.appendChild(keys);
      var ex = el('div', 'pl-example-row');
      ex.appendChild(example([{ rank: '8', suit: 'spades' }, { rank: '7', suit: 'hearts' }], 'Build down, alternating red and black.'));
      ex.appendChild(example([{ rank: 'A', suit: 'diamonds' }, { rank: '2', suit: 'diamonds' }], 'Foundations build up by suit, ace to king.'));
      return [
        rulesSection('Goal', [para('Move all 52 cards to the four foundations, one per suit, from ace up to king.')]),
        rulesSection('The table', [diagram, para('Every card is dealt face up into eight columns. Top left are four free cells; top right, four foundations.')]),
        rulesSection('Moves', [list([
          'Move the last card of any column, or a card from a free cell.',
          'Onto a column: one rank lower and the opposite color, like a red 7 on a black 8.',
          'Into a free cell: any single card. Each cell holds one.',
          'Into an empty column: any card, or a run of cards.',
          'Runs move as a unit if there is room to shuffle them through: (free cells + 1) × 2 for each empty column.'
        ]), ex]),
        rulesSection('Tips', [list([
          'Free cells are precious. Fill one only when it opens up something better.',
          'Free aces and twos early.',
          'An empty column is worth more than a free cell.'
        ])]),
        rulesSection('Deal numbers', [para('Deals are numbered, so a friend can play the same one. Nearly every deal can be solved — of the classic 32,000, only #11982 cannot.')])
      ];
    }
  };
  function RulesSheet(props) {
    props = props || {};
    var key = String(props.game || 'freecell').toLowerCase();
    var name = GAME_NAMES[key] || key;
    return Sheet({ title: 'How to play ' + name, onClose: props.onClose, className: 'pl-rules', children: (RULES[key] || RULES.freecell)(),
      footer: [Button({ label: 'Got it', variant: 'primary', onClick: props.onClose })] });
  }

  /* ---------- WinDialog ---------- */
  function WinDialog(props) {
    props = props || {};
    var art = el('div', 'pl-win-art');
    ['spades', 'hearts', 'diamonds', 'clubs'].forEach(function (s) { art.appendChild(PlayingCard({ rank: 'K', suit: s, size: 52 })); });
    var line = el('p', 'pl-win-line', [props.deal ? 'Deal #' + props.deal : null, props.time ? 'in ' + props.time : null, props.moves != null ? props.moves + ' moves' : null].filter(Boolean).join(' · '));
    var kids = [line];
    if (props.newBest) kids.push(el('span', 'pl-chip-brass', 'New best time'));
    var stats = el('dl', 'pl-win-stats');
    (props.stats || [{ label: 'Best', value: props.best || '—' }, { label: 'Streak', value: props.streak == null ? '—' : props.streak }, { label: 'Won', value: props.winRate || '—' }]).forEach(function (s) {
      var d = el('div', 'pl-win-stat'); d.appendChild(el('dt', null, s.label)); d.appendChild(el('dd', null, String(s.value))); stats.appendChild(d);
    });
    kids.push(stats);
    return Sheet({ title: props.title || 'Solved!', art: art, onClose: false, className: 'pl-win', children: kids, footer: [
      Button({ label: 'Deal again', variant: 'primary', onClick: props.onDealAgain }),
      Button({ label: 'Replay this deal', onClick: props.onReplay }),
      props.onHome ? Button({ label: 'All games', onClick: props.onHome }) : null
    ] });
  }

  /* ---------- Toggle and Segmented ---------- */
  function Toggle(props) {
    props = props || {};
    var b = el('button', 'pl-toggle'); b.type = 'button';
    b.setAttribute('role', 'switch');
    if (props.label) b.setAttribute('aria-label', props.label);
    if (props.labelledBy) b.setAttribute('aria-labelledby', props.labelledBy);
    b.appendChild(el('span', 'pl-toggle-knob'));
    function set(v) { b.setAttribute('aria-checked', v ? 'true' : 'false'); }
    set(!!props.checked);
    b.addEventListener('click', function () { var v = b.getAttribute('aria-checked') !== 'true'; set(v); if (props.onChange) props.onChange(v); });
    b.setValue = set;
    return b;
  }
  function Segmented(props) {
    props = props || {};
    var g = el('div', 'pl-seg'); g.setAttribute('role', 'radiogroup');
    if (props.label) g.setAttribute('aria-label', props.label);
    if (props.labelledBy) g.setAttribute('aria-labelledby', props.labelledBy);
    var btns = [];
    function set(v) { btns.forEach(function (b) { var on = b.dataset.value === String(v); b.setAttribute('aria-checked', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; }); }
    (props.options || []).forEach(function (o) {
      var val = Array.isArray(o) ? o[0] : o.value, lab = Array.isArray(o) ? o[1] : o.label;
      var b = el('button', 'pl-seg-opt', lab); b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.value = String(val);
      b.addEventListener('click', function () { set(val); if (props.onChange) props.onChange(val); });
      b.addEventListener('keydown', function (e) {
        var i = btns.indexOf(b), n = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = btns[(i + 1) % btns.length];
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = btns[(i - 1 + btns.length) % btns.length];
        if (n) { e.preventDefault(); n.focus(); n.click(); }
      });
      btns.push(b); g.appendChild(b);
    });
    set(props.value);
    g.setValue = set;
    return g;
  }

  /* ---------- Settings: one JSON document ---------- */
  var SETTINGS_SCHEMA = [
    { id: 'appearance', title: 'Appearance', rows: [
      { key: 'theme', label: 'Theme', type: 'choice', options: [['system', 'Auto'], ['light', 'Day'], ['dark', 'Night']], def: 'system' },
      { key: 'cardSize', label: 'Card size', help: 'Auto fills the table. Smaller sizes leave room around it.', type: 'choice', options: [['auto', 'Auto'], ['small', 'S'], ['medium', 'M'], ['large', 'L']], def: 'auto' },
      { key: 'cardStyle', label: 'Card corners', help: 'Large index makes ranks easier to read on phones.', type: 'choice', options: [['classic', 'Classic'], ['large-index', 'Large index']], def: 'classic' },
      { key: 'fourColor', label: 'Four-color deck', help: 'Diamonds blue, clubs green.', type: 'toggle', def: false },
      { key: 'deck', label: 'Deck', type: 'ref', kind: 'deck', def: 'parlor.deck.classic' },
      { key: 'table', label: 'Table', type: 'ref', kind: 'table', def: 'parlor.table.baize' },
      { key: 'reduceMotion', label: 'Reduce motion', type: 'choice', options: [['system', 'Auto'], ['on', 'On'], ['off', 'Off']], def: 'system' }
    ] },
    { id: 'play', title: 'Play', rows: [
      { key: 'input', label: 'Move cards by', type: 'choice', options: [['both', 'Tap or drag'], ['tap', 'Tap'], ['drag', 'Drag']], def: 'both' },
      { key: 'autoMove', label: 'Auto-move to foundations', help: 'Safe moves only cards nothing else can use.', type: 'choice', options: [['off', 'Off'], ['safe', 'Safe'], ['always', 'Always']], def: 'safe' },
      { key: 'hints', label: 'Hints', type: 'toggle', def: true },
      { key: 'showTimer', label: 'Show timer', type: 'toggle', def: true },
      { key: 'showMoves', label: 'Show move count', type: 'toggle', def: true },
      { key: 'confirmNewGame', label: 'Ask before leaving a game', type: 'toggle', def: true },
      { key: 'leftHanded', label: 'Left-handed layout', help: 'Free cells move to the right, foundations to the left.', type: 'toggle', def: false }
    ] },
    { id: 'freecell', title: 'FreeCell', rows: [
      { key: 'deal', label: 'New games', type: 'choice', options: [['random', 'Random'], ['daily', 'Daily deal'], ['ascending', 'In order']], def: 'random' },
      { key: 'freeCells', label: 'Free cells', help: 'Fewer cells, harder game.', type: 'choice', options: [[4, '4'], [3, '3'], [2, '2'], [1, '1']], def: 4 },
      { key: 'supermoves', label: 'Move runs in one go', help: 'Moves as many cards as your free spaces allow.', type: 'toggle', def: true }
    ] }
  ];
  var SETTINGS_VERSION = 1, STORE_KEY = 'parlor.settings.v1';
  function settingsDefaults() {
    var s = { app: 'parlor', version: SETTINGS_VERSION };
    SETTINGS_SCHEMA.forEach(function (g) { s[g.id] = {}; g.rows.forEach(function (r) { s[g.id][r.key] = r.def; }); });
    return s;
  }
  function validRow(r, v) {
    if (r.type === 'toggle') return typeof v === 'boolean';
    if (r.type === 'ref') return typeof v === 'string' && /^[a-z0-9][a-z0-9.-]{0,63}$/.test(v);
    return r.options.some(function (o) { return o[0] === v; });
  }
  /* validate(input) → { settings, applied, ignored: [paths], warnings: [text] }. Never throws on user files. */
  function settingsValidate(input) {
    var out = settingsDefaults(), ignored = [], warnings = [], applied = 0, data = input;
    if (typeof input === 'string') { try { data = JSON.parse(input); } catch (e) { return { settings: out, applied: 0, ignored: [], warnings: ['This file isn’t valid JSON, so nothing changed.'] }; } }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { settings: out, applied: 0, ignored: [], warnings: ['No settings found in this file.'] };
    if (data.app && data.app !== 'parlor') warnings.push('This file is for “' + data.app + '”; Parlor read what it could.');
    if (typeof data.version === 'number' && data.version > SETTINGS_VERSION) warnings.push('Made by a newer Parlor. Settings this version doesn’t know were skipped.');
    Object.keys(data).forEach(function (k) {
      if (k === 'app' || k === 'version' || k === '$schema' || k === 'name' || k === 'note') return;
      var g = SETTINGS_SCHEMA.filter(function (x) { return x.id === k; })[0];
      if (!g || !data[k] || typeof data[k] !== 'object') { ignored.push(k); return; }
      Object.keys(data[k]).forEach(function (rk) {
        var r = g.rows.filter(function (x) { return x.key === rk; })[0];
        if (r && validRow(r, data[k][rk])) { out[k][rk] = data[k][rk]; applied++; } else ignored.push(k + '.' + rk);
      });
    });
    if (typeof data.name === 'string') out.name = data.name.slice(0, 80);
    if (typeof data.note === 'string') out.note = data.note.slice(0, 280);
    return { settings: out, applied: applied, ignored: ignored, warnings: warnings };
  }
  function settingsToJSON(s) {
    var o = { '$schema': 'parlor-settings.schema.json', app: 'parlor', version: SETTINGS_VERSION };
    if (s.name) o.name = s.name;
    if (s.note) o.note = s.note;
    SETTINGS_SCHEMA.forEach(function (g) { o[g.id] = {}; g.rows.forEach(function (r) { o[g.id][r.key] = s[g.id] && validRow(r, s[g.id][r.key]) ? s[g.id][r.key] : r.def; }); });
    return JSON.stringify(o, null, 2);
  }
  function settingsLoad() {
    try { var raw = window.localStorage.getItem(STORE_KEY); return raw ? settingsValidate(raw).settings : settingsDefaults(); } catch (e) { return settingsDefaults(); }
  }
  function settingsSave(s) { try { window.localStorage.setItem(STORE_KEY, settingsToJSON(s)); return true; } catch (e) { return false; } }
  /* apply(settings, root) — reflect appearance and layout settings as attributes/classes the CSS reads. */
  function settingsApply(s, root) {
    root = root || document.documentElement;
    var a = s.appearance || {}, p = s.play || {};
    var theme = a.theme;
    if (theme === 'system' || !theme) { try { theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { theme = 'light'; } }
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-card-size', a.cardSize || 'auto');
    root.classList.toggle('pl-large-index', a.cardStyle === 'large-index');
    root.classList.toggle('pl-4c', !!a.fourColor);
    var rm = a.reduceMotion;
    if (rm === 'system') { try { rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'on' : 'off'; } catch (e) { rm = 'off'; } }
    root.classList.toggle('pl-reduce-motion', rm === 'on');
    if (p.leftHanded) root.setAttribute('data-hand', 'left'); else root.removeAttribute('data-hand');
    ['deck', 'table'].forEach(function (k) { if (a[k] && REG[a[k]]) { mountStyle(REG[a[k]]); root.setAttribute('data-' + k, a[k]); } });
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) { var felt = getComputedStyle(root).getPropertyValue('--felt').trim(); if (felt) meta.setAttribute('content', felt); }
    return theme;
  }
  function settingsExport(s) {
    var blob = new Blob([settingsToJSON(s)], { type: 'application/json' });
    var file = null;
    try { file = new File([blob], 'parlor-settings.json', { type: 'application/json' }); } catch (e) {}
    if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      return navigator.share({ files: [file], title: 'Parlor settings' }).then(function () { return 'shared'; }, function () { return 'cancelled'; });
    }
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'parlor-settings.json';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    return Promise.resolve('downloaded');
  }
  function settingsImportFile(file) {
    return new Promise(function (resolve) {
      if (!file) return resolve(settingsValidate(null));
      if (file.size > 65536) return resolve({ settings: settingsDefaults(), applied: 0, ignored: [], warnings: ['That file is too large to be a settings file.'] });
      var r = new FileReader();
      r.onload = function () { resolve(settingsValidate(String(r.result))); };
      r.onerror = function () { resolve({ settings: settingsDefaults(), applied: 0, ignored: [], warnings: ['Couldn’t read that file.'] }); };
      r.readAsText(file);
    });
  }

  /* SettingsPanel — every setting from SETTINGS_SCHEMA, plus the settings file actions. */
  function SettingsPanel(props) {
    props = props || {};
    var state = settingsValidate(props.settings || settingsDefaults()).settings;
    var controls = {};
    var status = el('p', 'pl-set-status'); status.setAttribute('role', 'status');
    function changed() { if (props.onChange) props.onChange(JSON.parse(settingsToJSON(state))); }
    var groups = SETTINGS_SCHEMA.map(function (g) {
      var sec = el('div', 'pl-set-group');
      sec.appendChild(el('h3', 'pl-h3', g.title));
      g.rows.forEach(function (r) {
        if (r.type === 'ref') return;
        var row = el('div', 'pl-set-row');
        var text = el('div', 'pl-set-text');
        var lab = el('span', 'pl-set-label', r.label); lab.id = 'pl-set-' + g.id + '-' + r.key;
        text.appendChild(lab);
        if (r.help) text.appendChild(el('span', 'pl-set-help', r.help));
        row.appendChild(text);
        var ctl = r.type === 'toggle'
          ? Toggle({ checked: state[g.id][r.key], labelledBy: lab.id, onChange: function (v) { state[g.id][r.key] = v; changed(); } })
          : Segmented({ options: r.options, value: state[g.id][r.key], labelledBy: lab.id, onChange: function (v) { state[g.id][r.key] = v; changed(); } });
        controls[g.id + '.' + r.key] = ctl;
        row.appendChild(ctl);
        sec.appendChild(row);
      });
      return sec;
    });
    function refresh() { SETTINGS_SCHEMA.forEach(function (g) { g.rows.forEach(function (r) { if (r.type === 'ref') return; controls[g.id + '.' + r.key].setValue(state[g.id][r.key]); }); }); }
    var file = el('input'); file.type = 'file'; file.accept = 'application/json,.json'; file.hidden = true;
    file.addEventListener('change', function () {
      settingsImportFile(file.files && file.files[0]).then(function (res) {
        if (res.applied) { state = res.settings; refresh(); changed(); }
        var msg = res.applied ? 'Imported ' + res.applied + ' setting' + (res.applied === 1 ? '' : 's') + (res.settings.name ? ' from “' + res.settings.name + '”' : '') + '.' : 'Nothing imported.';
        if (res.ignored.length) msg += ' Skipped ' + res.ignored.length + ' unknown or invalid.';
        if (res.warnings.length) msg += ' ' + res.warnings.join(' ');
        status.textContent = msg;
        file.value = '';
      });
    });
    var share = el('div', 'pl-set-group pl-set-file');
    share.appendChild(el('h3', 'pl-h3', 'Settings file'));
    share.appendChild(el('p', 'pl-set-help', 'Save your settings as a small JSON file to back them up, move them to another device, or share them. Importing never touches your stats or saved game.'));
    var acts = el('div', 'pl-set-actions');
    acts.appendChild(Button({ label: 'Export', onClick: function () { settingsExport(state).then(function (how) { if (how !== 'cancelled') status.textContent = how === 'shared' ? 'Settings shared.' : 'Saved parlor-settings.json.'; }); } }));
    acts.appendChild(Button({ label: 'Import…', onClick: function () { file.click(); } }));
    acts.appendChild(Button({ label: 'Copy JSON', onClick: function () {
      var txt = settingsToJSON(state);
      try { navigator.clipboard.writeText(txt).then(function () { status.textContent = 'Copied to clipboard.'; }, function () { status.textContent = 'Couldn’t copy here. Use Export instead.'; }); } catch (e) { status.textContent = 'Couldn’t copy here. Use Export instead.'; }
    } }));
    acts.appendChild(Button({ label: 'Reset to defaults', onClick: function () { state = settingsDefaults(); refresh(); changed(); status.textContent = 'Back to the defaults.'; } }));
    share.appendChild(acts); share.appendChild(file); share.appendChild(status);
    return Sheet({ title: 'Settings', onClose: props.onClose, className: 'pl-settings', children: groups.concat([share]) });
  }

  /* =====================================================================
     CONTENT LAYER — decks, tables, layouts, rulesets and packs as data.
     Everything an editor makes or the shop sells is one of these JSON
     definitions. Components render from them; nothing is hard-coded twice.
     ===================================================================== */
  var FORMAT = 1;
  var ID_RE = /^[a-z0-9][a-z0-9.-]{0,63}$/;
  var HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

  function hexToRgb(h) {
    h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function luminance(hex) {
    var c = hexToRgb(hex).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    if (!HEX_RE.test(a) || !HEX_RE.test(b)) return 0;
    var x = luminance(a), y = luminance(b); if (x < y) { var t = x; x = y; y = t; }
    return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
  }
  /* A colour value is "#hex" (both themes) or {"light": "#hex", "dark": "#hex"}. */
  function colorOK(v) { return typeof v === 'string' ? HEX_RE.test(v) : !!(v && typeof v === 'object' && HEX_RE.test(v.light || '') && (!v.dark || HEX_RE.test(v.dark))); }
  function themed(v, theme) { return typeof v === 'string' ? v : (v[theme] || v.light); }

  /* ---- field descriptors per kind: path, type, default, label (editors read these too) ---- */
  var C = function (light, dark) { return dark ? { light: light, dark: dark } : light; };
  var KINDS = {
    deck: [
      { path: 'face.color', type: 'color', def: C('#fbf7ec', '#e9e3d4'), label: 'Card face', css: '--card-face' },
      { path: 'face.edge', type: 'color', def: C('#d6ccb6', '#b3a98f'), label: 'Card edge', css: '--card-edge' },
      { path: 'suits.hearts', type: 'color', def: '#b3261e', label: 'Hearts', css: '--suit-hearts' },
      { path: 'suits.diamonds', type: 'color', def: '#b3261e', label: 'Diamonds', css: '--suit-diamonds' },
      { path: 'suits.spades', type: 'color', def: '#1d1f1e', label: 'Spades', css: '--suit-spades' },
      { path: 'suits.clubs', type: 'color', def: '#1d1f1e', label: 'Clubs', css: '--suit-clubs' },
      { path: 'fourColor.diamonds', type: 'color', def: '#1a5aa8', label: 'Diamonds (four-color)', css: '--suit-blue' },
      { path: 'fourColor.clubs', type: 'color', def: '#0f5a2c', label: 'Clubs (four-color)', css: '--suit-green' },
      { path: 'index.font', type: 'enum', options: ['serif', 'sans'], def: 'serif', label: 'Index font' },
      { path: 'court.style', type: 'enum', options: ['framed', 'plain'], def: 'framed', label: 'Court cards' },
      { path: 'corners', type: 'enum', options: ['square', 'standard', 'round'], def: 'standard', label: 'Corners' },
      { path: 'back.pattern', type: 'enum', options: ['lattice', 'stripes', 'dots', 'plain'], def: 'lattice', label: 'Back pattern' },
      { path: 'back.color', type: 'color', def: C('#7d1f2c', '#6a1a25'), label: 'Back color', css: '--card-back' },
      { path: 'back.line', type: 'color', def: C('#a84353', '#8e3442'), label: 'Back pattern color', css: '--card-back-line' }
    ],
    table: [
      { path: 'felt', type: 'color', def: C('#1f5b43', '#143a2b'), label: 'Felt', css: '--felt' },
      { path: 'feltDeep', type: 'color', def: C('#17462f', '#0e2a1f'), label: 'Recessed felt', css: '--felt-deep' },
      { path: 'feltLine', type: 'color', def: C('#8fb9a3', '#6f9a85'), label: 'Slot outline', css: '--felt-line' },
      { path: 'onFelt', type: 'color', def: C('#f4efe3', '#ece6d8'), label: 'Text on felt', css: '--on-felt' },
      { path: 'onFeltMuted', type: 'color', def: C('#bcd2c5', '#a9c0b3'), label: 'Muted text on felt', css: '--on-felt-muted' },
      { path: 'hint', type: 'color', def: C('#8fd0f5', '#7cc4f0'), label: 'Hint glow', css: '--hint' },
      { path: 'focus', type: 'color', def: C('#f4d27a', '#f0cc6e'), label: 'Focus ring', css: '--focus-felt' }
    ]
  };
  /* Contrast rules every deck and table must pass to be sold; imports only warn. */
  var CHECKS = {
    deck: [['suits.hearts', 'face.color', 4.5], ['suits.diamonds', 'face.color', 4.5], ['suits.spades', 'face.color', 4.5], ['suits.clubs', 'face.color', 4.5], ['fourColor.diamonds', 'face.color', 4.5], ['fourColor.clubs', 'face.color', 4.5]],
    table: [['onFelt', 'felt', 4.5], ['onFeltMuted', 'felt', 4.5], ['onFelt', 'feltDeep', 4.5], ['feltLine', 'felt', 3], ['focus', 'felt', 3], ['hint', 'felt', 3]]
  };
  function getPath(o, p) { return p.split('.').reduce(function (a, k) { return a == null ? undefined : a[k]; }, o); }
  function setPath(o, p, v) { var ks = p.split('.'), last = ks.pop(); ks.reduce(function (a, k) { return a[k] = a[k] && typeof a[k] === 'object' ? a[k] : {}; }, o)[last] = v; }

  function checkContrast(kind, def) {
    var out = [];
    (CHECKS[kind] || []).forEach(function (c) {
      ['light', 'dark'].forEach(function (th) {
        var a = getPath(def, c[0]), b = getPath(def, c[1]); if (a == null || b == null) return;
        var r = contrast(themed(a, th), themed(b, th));
        if (r < c[2]) out.push({ fg: c[0], bg: c[1], theme: th, ratio: r, need: c[2] });
      });
    });
    var seen = {}; return out.filter(function (x) { var k = x.fg + x.bg + x.ratio; if (seen[k]) return false; seen[k] = 1; return true; });
  }

  /* validate(def) → { def, ok, warnings, contrast }. Lenient like settings: bad fields fall back, never throws. */
  function defValidate(input) {
    var d = input, warnings = [];
    if (typeof input === 'string') { try { d = JSON.parse(input); } catch (e) { return { def: null, ok: false, warnings: ['Not valid JSON.'], contrast: [] }; } }
    if (!d || typeof d !== 'object') return { def: null, ok: false, warnings: ['No definition found.'], contrast: [] };
    var kind = d.kind;
    if (['deck', 'table', 'layout', 'ruleset', 'pack'].indexOf(kind) < 0) return { def: null, ok: false, warnings: ['Unknown kind “' + kind + '”.'], contrast: [] };
    if (!ID_RE.test(d.id || '')) return { def: null, ok: false, warnings: ['Missing or invalid id (lowercase letters, digits, dots, dashes).'], contrast: [] };
    var out = { kind: kind, id: d.id, format: FORMAT, version: typeof d.version === 'string' ? d.version.slice(0, 20) : '1.0.0', name: typeof d.name === 'string' ? d.name.slice(0, 60) : d.id };
    if (d.author && typeof d.author.name === 'string') out.author = { name: d.author.name.slice(0, 60) };
    if (typeof d.description === 'string') out.description = d.description.slice(0, 400);
    if (typeof d.format === 'number' && d.format > FORMAT) warnings.push('Made for a newer Parlor; unknown fields skipped.');
    if (KINDS[kind]) {
      KINDS[kind].forEach(function (f) {
        var v = getPath(d, f.path);
        if (v === undefined) { setPath(out, f.path, f.def); return; }
        var good = f.type === 'color' ? colorOK(v) : f.options.indexOf(v) >= 0;
        if (good) setPath(out, f.path, v); else { setPath(out, f.path, f.def); warnings.push(f.label + ': invalid value, using default.'); }
      });
    } else if (kind === 'layout') {
      out.columns = Math.max(1, Math.min(12, d.columns | 0 || 8));
      out.zones = (Array.isArray(d.zones) ? d.zones : []).filter(function (z) {
        var ok = z && ID_RE.test(z.id || '') && ZONE_KINDS.indexOf(z.kind) >= 0 && z.row >= 1 && z.col >= 1 && z.count >= 1 && z.col + z.count - 1 <= out.columns;
        if (!ok) warnings.push('Zone ' + (z && z.id) + ' skipped: needs id, kind, row, col, count inside the columns.');
        return ok;
      }).map(function (z) { return { id: z.id, kind: z.kind, row: z.row | 0, col: z.col | 0, count: z.count | 0, fan: ['down', 'right', 'none'].indexOf(z.fan) >= 0 ? z.fan : (z.kind === 'tableau' ? 'down' : 'none'), mirror: !!z.mirror, suits: Array.isArray(z.suits) ? z.suits.filter(suitOf) : undefined, label: typeof z.label === 'string' ? z.label.slice(0, 3) : undefined }; });
    } else if (kind === 'ruleset') {
      out.layout = ID_RE.test(d.layout || '') ? d.layout : 'parlor.layout.freecell';
      out.deal = { method: ['numbered', 'shuffled'].indexOf(d.deal && d.deal.method) >= 0 ? d.deal.method : 'shuffled', to: (d.deal && d.deal.to) || 'tableau', faceUp: !(d.deal && d.deal.faceUp === false) };
      out.zones = {};
      Object.keys(d.zones || {}).forEach(function (k) {
        var z = d.zones[k] || {};
        out.zones[k] = {
          pickUp: ['none', 'top', 'run'].indexOf(z.pickUp) >= 0 ? z.pickUp : 'top',
          run: BUILDS.indexOf(z.run) >= 0 ? z.run : undefined,
          build: BUILDS.indexOf(z.build) >= 0 ? z.build : 'none',
          empty: ['any', 'A', 'K', 'none'].indexOf(z.empty) >= 0 ? z.empty : 'any',
          capacity: z.capacity > 0 ? z.capacity | 0 : undefined
        };
      });
      out.runLimit = d.runLimit === 'freecell' ? 'freecell' : 'none';
      out.autoMove = ['off', 'safe', 'always'].indexOf(d.autoMove) >= 0 ? d.autoMove : 'safe';
      out.win = 'foundations-full';
      if (d.options && typeof d.options === 'object') out.options = d.options;
    } else if (kind === 'pack') {
      out.contents = (Array.isArray(d.contents) ? d.contents : []).filter(function (x) { return ID_RE.test(x); });
      out.price = d.price && ['included', 'free', 'paid', 'earned'].indexOf(d.price.type) >= 0 ? { type: d.price.type, display: typeof d.price.display === 'string' ? d.price.display.slice(0, 12) : undefined, sku: typeof d.price.sku === 'string' ? d.price.sku : undefined } : { type: 'free' };
      out.preview = d.preview && typeof d.preview === 'object' ? { deck: d.preview.deck, table: d.preview.table, game: d.preview.game } : {};
      out.definitions = (Array.isArray(d.definitions) ? d.definitions : []).map(function (x) { var r = defValidate(x); warnings = warnings.concat(r.warnings); return r.def; }).filter(Boolean);
    }
    var cx = checkContrast(kind, out);
    return { def: out, ok: true, warnings: warnings, contrast: cx };
  }

  /* ---- registry ---- */
  var REG = {};
  function defRegister(input) {
    var r = defValidate(input); if (!r.def) return r;
    REG[r.def.id] = r.def;
    if (r.def.kind === 'pack') r.def.definitions.forEach(function (x) { REG[x.id] = x; });
    if (r.def.kind === 'deck' || r.def.kind === 'table') mountStyle(r.def);
    return r;
  }
  function defGet(id) { return REG[id] || null; }
  function defList(kind) { return Object.keys(REG).map(function (k) { return REG[k]; }).filter(function (d) { return !kind || d.kind === kind; }); }

  /* ---- scoped styles: data-deck="id" / data-table="id" on any element ---- */
  var BACKS = {
    lattice: 'repeating-linear-gradient(45deg, var(--card-back-line) 0 1px, transparent 1px 7px), repeating-linear-gradient(-45deg, var(--card-back-line) 0 1px, transparent 1px 7px)',
    stripes: 'repeating-linear-gradient(135deg, var(--card-back-line) 0 3px, transparent 3px 9px)',
    dots: 'radial-gradient(circle, var(--card-back-line) 1.4px, transparent 1.6px)',
    plain: 'none'
  };
  var CORNERS = { square: '2px', standard: '6px', round: '10px' };
  function cssFor(def, theme) {
    var attr = def.kind === 'deck' ? 'data-deck' : 'data-table', sel = '[' + attr + '="' + def.id + '"]', decl = [];
    KINDS[def.kind].forEach(function (f) { if (f.css) decl.push(f.css + ':' + themed(getPath(def, f.path), theme)); });
    if (def.kind === 'deck' && theme === 'light') {
      decl.push('--card-back-image:' + BACKS[def.back.pattern]);
      decl.push('--card-back-size:' + (def.back.pattern === 'dots' ? '8px 8px' : 'auto'));
      decl.push('--card-font:' + (def.index.font === 'sans' ? 'var(--font-ui)' : 'var(--font-display)'));
      decl.push('--court-border:' + (def.court.style === 'plain' ? '0px' : '1px'));
      decl.push('--card-radius:' + CORNERS[def.corners]);
    }
    if (theme === 'dark') sel = '[data-theme="dark"] ' + sel + ', [data-theme="dark"]' + sel;
    return sel + '{' + decl.join(';') + '}';
  }
  function mountStyle(def) {
    if (typeof document === 'undefined' || !document.head) return;
    var id = 'pl-def-' + def.id.replace(/[^a-z0-9-]/g, '-');
    var s = document.getElementById(id);
    if (!s) { s = document.createElement('style'); s.id = id; document.head.appendChild(s); }
    s.textContent = cssFor(def, 'light') + '\n' + cssFor(def, 'dark');
  }
  /* use(element, {deck, table}) — dress any subtree in a deck and/or table by id or definition. */
  function defUse(node, refs) {
    refs = refs || {};
    ['deck', 'table'].forEach(function (k) {
      var r = refs[k]; if (!r) return;
      var d = typeof r === 'string' ? defGet(r) : defRegister(r).def;
      if (d) { mountStyle(d); node.setAttribute('data-' + k, d.id); }
    });
    return node;
  }

  /* ---- layouts: a grid of zones measured in card columns ---- */
  var ZONE_KINDS = ['cell', 'foundation', 'tableau', 'stock', 'waste', 'reserve'];
  function Board(props) {
    props = props || {};
    var L = typeof props.layout === 'string' ? defGet(props.layout) : (props.layout && defValidate(props.layout).def);
    if (!L) L = defGet('parlor.layout.freecell');
    var state = props.state || {};
    var left = props.leftHanded != null ? props.leftHanded : (typeof document !== 'undefined' && document.documentElement.getAttribute('data-hand') === 'left');
    var board = el('div', 'pl-board');
    board.style.setProperty('--cols', L.columns);
    board.setAttribute('data-layout', L.id);
    var sel = props.selection || null;
    L.zones.forEach(function (z) {
      var piles = state[z.id] || [];
      for (var i = 0; i < z.count; i++) {
        var pid = z.id + '.' + i, cards = piles[i] || [], node;
        var col = z.col + i;
        if (left && z.mirror) col = L.columns - col + 1;
        if (!cards.length) {
          node = CardSlot({ kind: z.kind === 'tableau' ? 'tableau' : z.kind === 'foundation' ? 'foundation' : 'cell', suit: z.suits ? z.suits[i] : undefined, label: z.label, hint: props.hint === pid });
        } else if (z.fan === 'none') {
          var top = cards[cards.length - 1];
          node = PlayingCard({ rank: top.rank, suit: top.suit, faceDown: top.faceDown, hint: top.hint || props.hint === pid, selected: sel && sel.pile === pid });
        } else {
          node = Pile({ cards: cards, selectedFrom: sel && sel.pile === pid ? sel.index : null, ariaLabel: (z.label || z.kind) + ' ' + (i + 1) });
          if (z.fan === 'right') node.classList.add('pl-pile-right');
        }
        node.classList.add('pl-zone', 'pl-zone-' + z.kind);
        node.setAttribute('data-pile', pid);
        node.style.gridRow = String(z.row);
        node.style.gridColumn = String(col);
        board.appendChild(node);
      }
    });
    if (props.deck || props.table) defUse(board, { deck: props.deck, table: props.table });
    return board;
  }

  /* ---- rules: a small vocabulary, enough for the FreeCell family ---- */
  var BUILDS = ['none', 'any', 'down-alternate', 'down-same-suit', 'down-any-suit', 'up-same-suit'];
  var RANK_N = { A: 1, J: 11, Q: 12, K: 13 };
  function rankN(r) { r = rankOf(r); return RANK_N[r] || parseInt(r, 10); }
  function colorOfSuit(s) { var x = suitOf(s); return x ? x.color : null; }
  function follows(under, over, build) {
    var a = rankN(under.rank), b = rankN(over.rank), sa = suitOf(under.suit).name, sb = suitOf(over.suit).name;
    switch (build) {
      case 'any': return true;
      case 'down-alternate': return b === a - 1 && colorOfSuit(sa) !== colorOfSuit(sb);
      case 'down-same-suit': return b === a - 1 && sa === sb;
      case 'down-any-suit': return b === a - 1;
      case 'up-same-suit': return b === a + 1 && sa === sb;
      default: return false;
    }
  }
  function zoneOf(pileId) { return String(pileId).split('.')[0]; }
  function pileOf(state, pileId) { var p = String(pileId).split('.'); return (state[p[0]] || [])[+p[1]] || []; }
  /* canMove(ruleset, state, from, index, to) → { ok, reason }. from/to are pile ids like "tableau.3". */
  function canMove(rs, state, from, index, to) {
    rs = typeof rs === 'string' ? defGet(rs) : rs;
    if (!rs) return { ok: false, reason: 'No ruleset.' };
    if (from === to) return { ok: false, reason: 'Same pile.' };
    var src = pileOf(state, from), moving = src.slice(index), fz = rs.zones[zoneOf(from)], tz = rs.zones[zoneOf(to)];
    if (!moving.length || !fz || !tz) return { ok: false, reason: 'Nothing to move.' };
    if (moving.some(function (c) { return c.faceDown; })) return { ok: false, reason: 'Face-down cards can’t move.' };
    if (fz.pickUp === 'none') return { ok: false, reason: 'Cards don’t leave this pile.' };
    if (fz.pickUp === 'top' && moving.length > 1) return { ok: false, reason: 'Only the top card moves.' };
    for (var i = 1; i < moving.length; i++) if (!follows(moving[i - 1], moving[i], fz.run || fz.build)) return { ok: false, reason: 'Not a run.' };
    var dst = pileOf(state, to);
    if (tz.capacity && dst.length + moving.length > tz.capacity) return { ok: false, reason: 'No room.' };
    if (!dst.length) {
      if (tz.empty === 'none') return { ok: false, reason: 'Can’t start this pile.' };
      if ((tz.empty === 'A' || tz.empty === 'K') && rankOf(moving[0].rank) !== tz.empty) return { ok: false, reason: 'Starts with ' + (tz.empty === 'A' ? 'an ace' : 'a king') + '.' };
      if (tz.build === 'up-same-suit' && moving.length > 1) return { ok: false, reason: 'One card at a time.' };
    } else {
      if (tz.build === 'none') return { ok: false, reason: 'Can’t build here.' };
      if (tz.build === 'up-same-suit' && moving.length > 1) return { ok: false, reason: 'One card at a time.' };
      if (!follows(dst[dst.length - 1], moving[0], tz.build)) return { ok: false, reason: 'Doesn’t fit.' };
    }
    if (rs.runLimit === 'freecell' && moving.length > 1) {
      var max = runCapacity(rs, state, to);
      if (moving.length > max) return { ok: false, reason: 'Only ' + max + ' cards can move with the free space you have.' };
    }
    return { ok: true };
  }
  function runCapacity(rs, state, to) {
    var cells = 0, cols = 0;
    Object.keys(rs.zones).forEach(function (k) {
      (state[k] || []).forEach(function (p, i) {
        if (p.length) return;
        if (rs.zones[k].capacity === 1) cells++;
        else if (rs.zones[k].pickUp === 'run' && k + '.' + i !== to) cols++;
      });
    });
    return (cells + 1) * Math.pow(2, cols);
  }
  function isWon(rs, state) {
    rs = typeof rs === 'string' ? defGet(rs) : rs;
    var f = Object.keys(rs.zones).filter(function (k) { return rs.zones[k].build === 'up-same-suit'; });
    return f.length > 0 && f.every(function (k) { return (state[k] || []).every(function (p) { return p.length === 13; }); });
  }
  /* deal(ruleset, n) → state for the ruleset's layout. "numbered" uses the classic FreeCell numbering. */
  function rulesDeal(rs, n) {
    rs = typeof rs === 'string' ? defGet(rs) : rs;
    var L = defGet(rs.layout), state = {};
    L.zones.forEach(function (z) { state[z.id] = []; for (var i = 0; i < z.count; i++) state[z.id].push([]); });
    var target = L.zones.filter(function (z) { return z.id === rs.deal.to; })[0];
    var seed = rs.deal.method === 'numbered' ? n : (n || Math.floor(Math.random() * 1e9));
    var cols = fcDeal(seed);
    if (target && target.count === 8) state[target.id] = cols;
    else if (target) { var all = []; for (var r = 0; r < 7; r++) cols.forEach(function (c) { if (c[r]) all.push(c[r]); }); all.forEach(function (c, i) { state[target.id][i % target.count].push(c); }); }
    if (rs.options && rs.options.freeCells && rs.options.freeCells.zone && state[rs.options.freeCells.zone]) {
      var want = rs.options.freeCells.value || 4; state[rs.options.freeCells.zone] = state[rs.options.freeCells.zone].slice(0, want);
    }
    return state;
  }

  /* ---- the built-in pack: today's look and FreeCell, expressed as definitions ---- */
  var CORE = {
    kind: 'pack', id: 'parlor.core', version: '1.0.0', name: 'Parlor Classics', author: { name: 'Parlor' },
    description: 'The classic deck, green baize and FreeCell. Always installed.',
    price: { type: 'included' }, preview: { deck: 'parlor.deck.classic', table: 'parlor.table.baize', game: 'freecell' },
    contents: ['parlor.deck.classic', 'parlor.table.baize', 'parlor.layout.freecell', 'parlor.rules.freecell'],
    definitions: [
      { kind: 'deck', id: 'parlor.deck.classic', version: '1.0.0', name: 'Classic' },
      { kind: 'table', id: 'parlor.table.baize', version: '1.0.0', name: 'Green baize' },
      { kind: 'layout', id: 'parlor.layout.freecell', version: '1.0.0', name: 'FreeCell', columns: 8, zones: [
        { id: 'cell', kind: 'cell', row: 1, col: 1, count: 4, mirror: true },
        { id: 'foundation', kind: 'foundation', row: 1, col: 5, count: 4, mirror: true, suits: ['spades', 'hearts', 'diamonds', 'clubs'] },
        { id: 'tableau', kind: 'tableau', row: 2, col: 1, count: 8, fan: 'down' }
      ] },
      { kind: 'ruleset', id: 'parlor.rules.freecell', version: '1.0.0', name: 'FreeCell', layout: 'parlor.layout.freecell',
        deal: { method: 'numbered', to: 'tableau', faceUp: true },
        zones: {
          cell: { pickUp: 'top', build: 'none', empty: 'any', capacity: 1 },
          foundation: { pickUp: 'none', build: 'up-same-suit', empty: 'A' },
          tableau: { pickUp: 'run', run: 'down-alternate', build: 'down-alternate', empty: 'any' }
        },
        runLimit: 'freecell', autoMove: 'safe', options: { freeCells: { zone: 'cell', values: [1, 2, 3, 4], value: 4 } } }
    ]
  };
  defRegister(CORE);

  /* ---------- ColorField ---------- */
  var colorFieldId = 0;
  function ColorField(props) {
    props = props || {};
    var id = 'pl-color-' + (++colorFieldId);
    var wrap = el('div', 'pl-color');
    var sw = el('input', 'pl-color-swatch'); sw.type = 'color'; sw.value = props.value || '#000000'; sw.setAttribute('aria-label', (props.label || 'Color') + ' picker');
    var hex = el('input', 'pl-color-hex'); hex.type = 'text'; hex.value = (props.value || '').toLowerCase(); hex.id = id; hex.spellcheck = false; hex.maxLength = 7; hex.setAttribute('aria-label', (props.label || 'Color') + ' hex');
    function set(v, from) {
      if (!HEX_RE.test(v)) { hex.setAttribute('aria-invalid', 'true'); return; }
      hex.removeAttribute('aria-invalid'); v = v.toLowerCase();
      if (v.length === 4) v = '#' + v.slice(1).split('').map(function (c) { return c + c; }).join('');
      if (from !== 'swatch') sw.value = v; if (from !== 'hex') hex.value = v;
      if (props.onChange && from) props.onChange(v);
    }
    sw.addEventListener('input', function () { set(sw.value, 'swatch'); });
    hex.addEventListener('change', function () { set(hex.value.trim(), 'hex'); });
    wrap.appendChild(sw); wrap.appendChild(hex);
    wrap.setValue = function (v) { set(v, null); };
    return wrap;
  }

  /* ---------- DeckEditor — the card editor ---------- */
  function DeckEditor(props) {
    props = props || {};
    var base = props.deck ? defValidate(props.deck).def : defGet('parlor.deck.classic');
    var deck = JSON.parse(JSON.stringify(base));
    if (!props.deck) { deck.id = 'my.deck.' + Math.random().toString(36).slice(2, 7); deck.name = 'My deck'; deck.author = { name: 'You' }; }
    var four = !!props.fourColor;
    var root = el('div', 'pl-editor');

    /* stage: live preview */
    var stage = el('div', 'pl-editor-stage');
    defUse(stage, { table: props.table || 'parlor.table.baize' });
    var stageBar = el('div', 'pl-editor-stagebar');
    stageBar.appendChild(el('span', 'pl-editor-stagelabel', 'Preview'));
    var themeSeg = Segmented({ label: 'Preview theme', value: 'light', options: [['light', 'Day'], ['dark', 'Night']], onChange: function (v) { stage.setAttribute('data-theme', v); } });
    stageBar.appendChild(themeSeg);
    stage.appendChild(stageBar);
    var fan = el('div', 'pl-editor-fan');
    var cards = [['A', 'spades'], ['K', 'hearts'], ['Q', 'diamonds'], ['10', 'clubs'], ['7', 'hearts']];
    function drawFan() {
      fan.textContent = '';
      cards.forEach(function (c) { fan.appendChild(PlayingCard({ rank: c[0], suit: c[1] })); });
      fan.appendChild(PlayingCard({ faceDown: true }));
    }
    var col = el('div', 'pl-editor-col');
    function drawCol() {
      col.textContent = '';
      col.appendChild(Pile({ cards: [{ faceDown: true }, { faceDown: true }, { rank: '9', suit: 'spades' }, { rank: '8', suit: 'diamonds' }, { rank: '7', suit: 'clubs' }, { rank: '6', suit: 'hearts' }] }));
    }
    var suitsRow = el('div', 'pl-editor-row'), courtsRow = el('div', 'pl-editor-row');
    function drawRows() {
      suitsRow.textContent = ''; courtsRow.textContent = '';
      ['spades', 'hearts', 'diamonds', 'clubs'].forEach(function (s) { suitsRow.appendChild(PlayingCard({ rank: 'A', suit: s })); });
      [['J', 'clubs'], ['Q', 'hearts'], ['K', 'spades'], ['K', 'diamonds']].forEach(function (c) { courtsRow.appendChild(PlayingCard({ rank: c[0], suit: c[1] })); });
    }
    var top = el('div', 'pl-editor-top'); top.appendChild(fan); top.appendChild(col);
    var stageCards = el('div', 'pl-editor-cards'); stageCards.appendChild(top); stageCards.appendChild(suitsRow); stageCards.appendChild(courtsRow);
    stage.appendChild(stageCards);
    var checks = el('ul', 'pl-editor-checks'); checks.setAttribute('aria-live', 'polite');
    stage.appendChild(checks);
    root.appendChild(stage);

    /* controls */
    var panel = el('div', 'pl-editor-panel');
    var nameRow = el('label', 'pl-field');
    nameRow.appendChild(el('span', 'pl-set-label', 'Deck name'));
    var nameIn = el('input', 'pl-text'); nameIn.type = 'text'; nameIn.value = deck.name; nameIn.maxLength = 60;
    nameIn.addEventListener('input', function () { deck.name = nameIn.value; changed(); });
    nameRow.appendChild(nameIn); panel.appendChild(nameRow);

    function group(title) { var g = el('div', 'pl-set-group'); g.appendChild(el('h3', 'pl-h3', title)); panel.appendChild(g); return g; }
    function row(g, label, ctl, help) {
      var r = el('div', 'pl-set-row'), t = el('div', 'pl-set-text');
      t.appendChild(el('span', 'pl-set-label', label)); if (help) t.appendChild(el('span', 'pl-set-help', help));
      r.appendChild(t); r.appendChild(ctl); g.appendChild(r); return r;
    }
    function colorRow(g, path, label, help) {
      var v = themed(getPath(deck, path), 'light');
      return row(g, label, ColorField({ value: v, label: label, onChange: function (x) { setPath(deck, path, x); changed(); } }), help);
    }
    var gFace = group('Face');
    colorRow(gFace, 'face.color', 'Card face');
    colorRow(gFace, 'face.edge', 'Edge', 'The hairline between overlapping cards.');
    row(gFace, 'Corners', Segmented({ label: 'Corners', value: deck.corners, options: [['square', 'Square'], ['standard', 'Standard'], ['round', 'Round']], onChange: function (v) { deck.corners = v; changed(); } }));

    var gSuits = group('Suits');
    var suitRows = {};
    row(gSuits, 'Colors', Segmented({ label: 'Suit colors', value: four ? 'four' : 'two', options: [['two', 'Two'], ['four', 'Four']], onChange: function (v) { four = v === 'four'; layoutSuits(); changed(); } }), 'Four gives each suit its own color.');
    suitRows.red = colorRow(gSuits, 'suits.hearts', 'Red suits');
    suitRows.black = colorRow(gSuits, 'suits.spades', 'Black suits');
    suitRows.diamonds = colorRow(gSuits, 'fourColor.diamonds', 'Diamonds');
    suitRows.clubs = colorRow(gSuits, 'fourColor.clubs', 'Clubs');
    function layoutSuits() {
      suitRows.diamonds.hidden = !four; suitRows.clubs.hidden = !four;
      root.classList.toggle('pl-4c', four);
    }

    var gIdx = group('Index and courts');
    row(gIdx, 'Index font', Segmented({ label: 'Index font', value: deck.index.font, options: [['serif', 'Serif'], ['sans', 'Sans']], onChange: function (v) { deck.index.font = v; changed(); } }));
    row(gIdx, 'Court cards', Segmented({ label: 'Court cards', value: deck.court.style, options: [['framed', 'Framed'], ['plain', 'Plain']], onChange: function (v) { deck.court.style = v; changed(); } }));

    var gBack = group('Back');
    row(gBack, 'Pattern', Segmented({ label: 'Back pattern', value: deck.back.pattern, options: [['lattice', 'Lattice'], ['stripes', 'Stripes'], ['dots', 'Dots'], ['plain', 'Plain']], onChange: function (v) { deck.back.pattern = v; changed(); } }));
    colorRow(gBack, 'back.color', 'Back color');
    colorRow(gBack, 'back.line', 'Pattern color');

    var foot = el('div', 'pl-editor-foot');
    var status = el('p', 'pl-set-status'); status.setAttribute('role', 'status');
    foot.appendChild(Button({ label: 'Export JSON', onClick: function () { download(deck.id + '.deck.json', JSON.stringify(output(), null, 2)); status.textContent = 'Exported ' + deck.id + '.deck.json'; } }));
    foot.appendChild(Button({ label: 'Start over', onClick: function () { root.replaceWith(DeckEditor(props)); } }));
    var save = Button({ label: 'Save deck', variant: 'primary', onClick: function () { var r = defRegister(output()); if (props.onSave) props.onSave(r.def, r); status.textContent = r.contrast.length ? 'Saved. Fix the flagged colors before sharing it in the shop.' : 'Saved “' + deck.name + '”.'; } });
    foot.appendChild(save);
    panel.appendChild(foot); panel.appendChild(status);
    root.appendChild(panel);

    function output() {
      var o = JSON.parse(JSON.stringify(deck));
      o.suits.diamonds = o.suits.hearts; o.suits.clubs = o.suits.spades;
      o.format = FORMAT; o.kind = 'deck';
      return o;
    }
    function changed() {
      var r = defRegister(output());
      defUse(stage, { deck: r.def.id });
      checks.textContent = '';
      var pairs = [['suits.hearts', 'Red suits'], ['suits.spades', 'Black suits']].concat(four ? [['fourColor.diamonds', 'Diamonds'], ['fourColor.clubs', 'Clubs']] : []);
      pairs.forEach(function (p) {
        var ratio = contrast(themed(getPath(r.def, p[0]), 'light'), themed(r.def.face.color, 'light'));
        var li = el('li', ratio >= 4.5 ? 'is-pass' : 'is-fail');
        li.appendChild(el('span', 'pl-check-mark', ratio >= 4.5 ? 'Pass' : 'Too low'));
        li.appendChild(el('span', null, p[1] + ' on face ' + ratio.toFixed(1) + ':1' + (ratio >= 4.5 ? '' : ' · needs 4.5:1')));
        checks.appendChild(li);
      });
      if (props.onChange) props.onChange(r.def);
    }
    function download(name, text) {
      try { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0); } catch (e) {}
    }
    layoutSuits(); drawFan(); drawCol(); drawRows(); changed();
    root.getDeck = output;
    return root;
  }

  /* ---------- PackCard — a pack in the shop ---------- */
  function PackCard(props) {
    props = props || {};
    var p = typeof props.pack === 'string' ? defGet(props.pack) : defRegister(props.pack).def;
    if (!p) return el('div');
    var card = el('article', 'pl-pack');
    var art = el('div', 'pl-pack-art');
    var kinds = {};
    p.contents.forEach(function (id) { var d = defGet(id); if (d) kinds[d.kind] = d; });
    var pv = p.preview || {};
    defUse(art, { deck: pv.deck || (kinds.deck && kinds.deck.id) || 'parlor.deck.classic', table: pv.table || (kinds.table && kinds.table.id) || 'parlor.table.baize' });
    if (kinds.ruleset && !kinds.deck) {
      var g = svg('svg', { viewBox: '0 0 120 72', 'aria-hidden': 'true', 'class': 'pl-glyph' }); (GLYPHS[pv.game] || GLYPHS.freecell)(g); art.appendChild(g);
    } else {
      var f = el('div', 'pl-pack-fan');
      [['A', 'spades'], ['K', 'hearts'], ['Q', 'diamonds']].forEach(function (c) { f.appendChild(PlayingCard({ rank: c[0], suit: c[1], size: 56 })); });
      f.appendChild(PlayingCard({ faceDown: true, size: 56 }));
      art.appendChild(f);
    }
    card.appendChild(art);
    var body = el('div', 'pl-pack-body');
    body.appendChild(el('h3', 'pl-pack-title', p.name));
    var labels = { deck: 'Deck', table: 'Table', layout: 'Board', ruleset: 'Game' };
    body.appendChild(el('p', 'pl-pack-meta', Object.keys(kinds).map(function (k) { return labels[k]; }).join(' · ') + (p.author ? ' · by ' + p.author.name : '')));
    if (p.description) body.appendChild(el('p', 'pl-pack-desc', p.description));
    var state = props.state || (p.price.type === 'included' ? 'in-use' : 'available');
    var label = state === 'in-use' ? 'In use' : state === 'owned' ? 'Use' : p.price.type === 'paid' ? (p.price.display || 'Buy') : p.price.type === 'earned' ? 'Locked' : 'Get · Free';
    var btn = Button({ label: label, variant: state === 'available' && p.price.type !== 'earned' ? 'primary' : 'quiet', disabled: state === 'in-use' || p.price.type === 'earned', onClick: props.onAction });
    var foot = el('div', 'pl-pack-foot'); foot.appendChild(btn);
    if (p.price.type === 'earned' && props.unlock) foot.appendChild(el('span', 'pl-pack-unlock', props.unlock));
    body.appendChild(foot);
    card.appendChild(body);
    return card;
  }

  /* render(target, nodeOrArray) — small helper to mount components. */
  function render(target, nodes) {
    if (typeof target === 'string') target = document.querySelector(target);
    if (!target) return;
    [].concat(nodes).forEach(function (n) { if (n) target.appendChild(n); });
    return target;
  }

  window.Parlor = window.Parlor || {};
  var api = {
    PlayingCard: PlayingCard, CardSlot: CardSlot, Pile: Pile, Suit: Suit, Button: Button, GameBar: GameBar, GameTile: GameTile,
    FreeCellTable: FreeCellTable, Sheet: Sheet, RulesSheet: RulesSheet, WinDialog: WinDialog, SettingsPanel: SettingsPanel, Toggle: Toggle, Segmented: Segmented,
    Board: Board, DeckEditor: DeckEditor, PackCard: PackCard, ColorField: ColorField,
    openSheet: openSheet, render: render, games: GAME_NAMES,
    defs: { format: FORMAT, kinds: KINDS, validate: defValidate, register: defRegister, get: defGet, list: defList, use: defUse, contrast: contrast, checkContrast: checkContrast },
    rules: { canMove: canMove, runCapacity: runCapacity, isWon: isWon, deal: rulesDeal, builds: BUILDS, zoneKinds: ZONE_KINDS },
    freecell: { deal: fcDeal },
    settings: { schema: SETTINGS_SCHEMA, version: SETTINGS_VERSION, storageKey: STORE_KEY, defaults: settingsDefaults, validate: settingsValidate, toJSON: settingsToJSON, load: settingsLoad, save: settingsSave, apply: settingsApply, exportFile: settingsExport, importFile: settingsImportFile }
  };
  for (var k in api) window.Parlor[k] = api[k];
})();
