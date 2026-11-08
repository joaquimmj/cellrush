# Architecture

```
apps/web          React + Vite UI. Reads engine state, renders the grid, owns the DOM.
packages/engine   Pure TypeScript, no DOM. Grid model, keymap, formula mini-engine, replay.
packages/drills   Task definitions (data-first) built on the engine.
supabase/         (M5) migrations + submit-run Edge Function that replays runs with packages/engine.
```

The engine never touches `window` or `document`: the web app converts each `KeyboardEvent` into a
`RawKey` (`{ code, key, ctrl, shift, alt, meta }`) and feeds it in. The same event stream can be
replayed on the server, which is what makes leaderboards verifiable.

Status: **M1** — keymap + layouts + capture matrix (M0), then the grid core: immutable sheets,
navigation (Ctrl/Cmd+Arrow, Ctrl+A region…), Ready/Enter/Edit modes, undo/redo/repeat, basic
formatting, Windows ribbon keytips, and a shortcut registry checked against Microsoft's page
(`verified` per platform). `/sandbox` is a keyboard-only playground on top of it.

**M2** adds `packages/engine/src/formula/`:

- `tokenizer.ts` → `parser.ts` (Pratt, Excel precedence: unary minus binds tighter than `^`) →
  `evaluator.ts` (SUM, AVERAGE, MIN, MAX, COUNT, ROUND, ABS, IF, IFERROR; `#DIV/0!`, `#VALUE!`,
  `#NAME?`, `#REF!`, `#ERROR!` for unparseable text).
- `recalc.ts`: full recalculation after every change (sheets are tiny), memoized, cycle detection
  (cells in a loop show 0 and are listed in `state.circular`, as Excel warns).
- `refs.ts`: rewrites references in the text the user typed — `shiftFormula` (fill, copy/paste,
  Ctrl+Enter), `structuralRewrite` (insert/delete rows/cols, incl. other sheets) and `cycleAnchor`
  (F4 / Cmd+T).

Grid side: clipboard with marching ants, Paste Special / Insert / Delete keyboard dialogs,
Point mode (arrows pick cells while typing a formula), AutoSum, sheet insert/switch.
Known gap: a cut-paste does not yet re-point other formulas at the moved cells (Excel does).
