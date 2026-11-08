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

**M3** adds `packages/drills`: 74 data-first drills (`src/tasks/`), a seeded RNG, synthetic
data, and a pure run engine (`src/run.ts`: `createRun` → `runKey(run, key, t)` → `scoreRun`).
A bot test plays every drill's optimal path on Windows and Mac × four layouts × six seeds.
The web app's `/` is the timed game (30/60/120 s, 25/50 drills, category filter) with a results
screen and local personal bests; `apps/web/e2e` plays full 60-second runs in Chrome via Playwright.
See `SCORING.md` and `ADDING_A_DRILL.md`.

**M4**: `/daily` (same seed for everyone per UTC day and platform, 10 drills, first finished
attempt is the ranked one, practice afterwards), share text in the §13 format
(`packages/drills/src/share.ts`), and result links `/r/:id`. Until M5 the id *is* the result
(base64url, validated on decode) — shareable, not proof. On Vercel, `vercel.json` routes
`/r/:id` to `apps/web/api/r.ts`, which injects Open Graph tags into the app shell, and
`apps/web/api/og.ts` renders the 1200×630 card. Both are unit-tested locally; nothing is deployed.

**M5**: Supabase (local first, see `SERVER.md`). Schema with RLS in `supabase/migrations/`;
`supabase/functions/submit-run` replays submitted keystrokes with the bundled engine
(`validateRun` in `packages/drills/src/validate.ts`), applies anti-cheat checks and rate limits,
and is the only writer of `runs`. Web: magic-link sign-in, profile (name, country, school,
platform), automatic submission with the server's verdict, `/leaderboard` (daily, modes,
schools, countries). `packages/server-tests` runs against the local stack (`pnpm test:db`).
