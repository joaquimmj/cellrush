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

Status: **M0** — keymap, layouts, environment detection, capture matrix and the `/keys` page.
