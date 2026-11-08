# Adding a theme

1. Copy `apps/web/src/themes/dark.json` to `apps/web/src/themes/<your-id>.json`.
2. Set `id` (kebab-case, same as the file name), `label`, `scheme` (`dark` or `light`) and the
   eight colours: `bg`, `panel`, `line`, `sub`, `text`, `accent`, `warn`, `bad` (`#rrggbb`).
3. Add it to the list in `apps/web/src/themes/index.ts`.
4. Run `pnpm --filter @cellrush/web test`. The theme test checks WCAG AA contrast (4.5:1) for
   `text` and `sub` on `bg` and `panel`, and for `accent`, `warn`, `bad` on `bg`. A theme that
   fails is not readable for everyone, so the test blocks it.

Themes only change colours. Please don't use a company's or school's name or logo for a theme.
