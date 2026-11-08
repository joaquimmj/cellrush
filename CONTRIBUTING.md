# Contributing to cellrush

Thanks for helping! The easiest first PRs are **a new drill** or **a new theme**: both are plain
data plus a test that tells you when it's right.

## Setup

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm test         # engine + drills + web unit tests
pnpm --filter @cellrush/web e2e   # Playwright (uses your installed Chrome locally)
```

Node 20+, pnpm 10. The leaderboards need a local Supabase (Docker); see [docs/SERVER.md](docs/SERVER.md).
You don't need it for drills, themes or the engine.

## Good first contributions

| What | Where | Guide |
|---|---|---|
| A drill | `packages/drills/src/tasks/*.ts` | [docs/ADDING_A_DRILL.md](docs/ADDING_A_DRILL.md) |
| A theme | `apps/web/src/themes/*.json` | [docs/ADDING_A_THEME.md](docs/ADDING_A_THEME.md) |
| A translation fix | `apps/web/src/i18n/`, `packages/drills/src/i18n.ts` | keep both languages in sync |
| A browser capture result | `packages/engine/src/keymap/capture-matrix.json` | run `/keys`, export the JSON |

Look for issues labelled [`good first issue`](https://github.com/joaquimmj/cellrush/labels/good%20first%20issue).

## Rules that keep the game honest

1. **Shortcuts must be verified** against Microsoft's official
   [Keyboard shortcuts in Excel](https://support.microsoft.com/en-us/office/keyboard-shortcuts-in-excel-1798d9d5-842a-42b8-9c99-9b7213f0040f)
   page, separately for Windows and Mac (`verified` in `packages/engine/src/keymap/registry.ts`).
   **Never invent a Mac equivalent**: no Mac shortcut means `mac: null`.
2. **Drills check the result, not the keys.** Any key path that reaches the goal passes.
3. **Deterministic.** Drill setup uses only the seeded RNG; data is made up.
4. **Every drill ships with a French prompt** (the i18n test fails otherwise).
5. **No "Excel" in names, logos or themes.** Descriptive text is fine. Not affiliated with Microsoft.

## Pull requests

- One topic per PR. Run `pnpm turbo run lint typecheck test` before pushing.
- Describe *how you tested* (which platform, which layout).
- Small, focused PRs get reviewed fastest (aim: within 24 h).

By contributing you agree that your contribution is licensed under the project's
[AGPL-3.0](LICENSE) and that you follow the [Code of Conduct](CODE_OF_CONDUCT.md).
