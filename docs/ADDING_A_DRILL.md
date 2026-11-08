# Adding a drill

Drills live in `packages/drills/src/tasks/<category>.ts`. A drill is plain data plus three
small functions:

```ts
defineTask<{ cell: CellAddr }>({
  id: "italic-cell",                      // kebab-case, unique
  category: "formatting",
  difficulty: 1,                           // 1–3
  prompt: (p) => `Make ${A1(p.cell)} italic`,
  setup(rng, ctx) {                        // build a sheet from the seeded rng only
    const t = makeTable(rng);
    const cell = at(t.numbers.r1, t.numbers.c1);
    return { state: stateOf(t.sheet, cell, ctx), params: { cell } };
  },
  check: (st, p) => isReady(st) && !!cellOf(st, p.cell)?.format.italic,   // look at the state, not the keys
  optimal: () => ({ win: ["ctrl+i"], mac: ["meta+i"] }),                  // null on a platform = not offered there
  requires: ["italic"],                    // registry shortcut ids used by the path
});
```

Rules:

1. **State-based checks.** Any key path that reaches the goal must pass.
2. **Deterministic setup.** Use only `rng` (never `Math.random`, never the clock); data is synthetic.
3. **Verified shortcuts only.** The optimal path may only use shortcuts in the registry
   (`packages/engine/src/keymap/registry.ts`). Avoid browser-reserved keys (Cmd+W/T/N/R/D…).
4. **Mac paths are never invented.** If Microsoft lists no Mac shortcut, set `mac: null`.

Then run `pnpm --filter @cellrush/drills test`: the bot plays your optimal path on both
platforms and four layouts and fails if it doesn't solve the drill exactly on its last key.
