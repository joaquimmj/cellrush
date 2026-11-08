# cellrush

Build brief: `cellrush-build-plan.md` (owner's copy). Repo stays private until launch; ask Joaquim before anything public, paid, a domain, or a license change.

## Testing

- All checks: `pnpm turbo run lint typecheck test build`
- Engine unit tests (vitest): `pnpm --filter @cellrush/engine test` — tests live in `packages/engine/test/`, use the helpers in `test/helpers.ts` (`grid()`, `keys()`, `type()`, `at()`, `sel()`, `raw()`).
- The engine is pure and deterministic: test behaviour through `dispatchKey` (real key presses), not by calling reducer internals.
- `apps/web` has no DOM test harness yet; keyboard e2e (Playwright) is planned for M3.
- `bun` lives in `~/.bun/bin` (not on PATH) for gstack tools.
