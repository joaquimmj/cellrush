# Keyboard handling

## Two kinds of shortcut keys

| Kind | Matches on | Used for | Example |
|---|---|---|---|
| `code` | `KeyboardEvent.code` (physical key) | digit row, F-keys, arrows, Enter, Space, symbols | Ctrl+Shift+5 → `{ ctrl, shift, code: "Digit5" }` |
| `char` | letter printed on the key, resolved through the layout table | letter shortcuts | Ctrl+B → `{ ctrl, char: "b" }` |

Why: on AZERTY, Excel's Ctrl+A is the key labelled **A**, which is physically `KeyQ`. Letter
shortcuts follow the label. The digit-row shortcuts (Ctrl+1, Ctrl+Shift+5…) follow the physical key.

`char` matching resolves the letter from `code` through the selected layout table rather than
trusting `event.key`, because `event.key` is unreliable with modifiers (macOS Option produces
`◊`, `∫`…). If a key is missing from the table, `event.key` is the fallback.

## Layouts

`us`, `uk`, `fr-azerty` (Windows variant), `de-qwertz`. Tables live in
`packages/engine/src/keymap/layouts.ts`, each tested in `test/layouts.test.ts`.
The layout is auto-guessed from the first plain keypresses (`guessLayout`) and can be overridden
in settings.

Known gap: the macOS "French" layout differs from Windows AZERTY on some symbol keys (digit row
unshifted symbols, `-`/`)`). Add a `fr-azerty-mac` table once tested on a real Mac.

## Capture matrix

Browsers keep some combos (Ctrl/Cmd+W, T, N…). `/keys` measures which ones reach the page, in a
normal tab and in fullscreen + Keyboard Lock (Chromium only). Export the JSON from the page and
merge it into `packages/engine/src/keymap/capture-matrix.json` (one entry per browser + OS + mode).

At runtime `capturability(comboId, env)` returns `ok`, `needs-lock`, `blocked` or `unknown`.
Drills whose shortcut is `blocked` are disabled; `needs-lock` shows a "needs fullscreen in
Chrome" badge; `unknown` stays playable.
