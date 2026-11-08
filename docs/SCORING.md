# Scoring

| Stat | Definition |
|---|---|
| **TPM** | completed drills ÷ elapsed minutes (timed modes always use the full duration) |
| **Efficiency** | Σ optimal keystrokes ÷ Σ actual keystrokes, over completed drills, capped at 100% |
| **Score** | `round(TPM × Efficiency × 100)` |

- The clock starts on the first key, not when the page loads.
- A **keystroke** is any keydown except a bare modifier (Ctrl, Shift, Alt, Cmd). A lone Alt that
  opens ribbon keytips is not counted either, so `Alt+=` and `Alt, H, 0` cost what their optimal
  paths say. Typed text counts one per character.
- Each drill's optimal path (`optimal()` in its definition) is checked by a bot test
  (`packages/drills/test/tasks.test.ts`): it must solve the drill exactly on its last key, on
  Windows and Mac, on US/UK/AZERTY/QWERTZ, for several seeds.
- Shift+Esc skips a drill (⬛ on the share card). Skipped drills count for nothing.
- Secondary stats: time per drill, the 3 slowest, undo presses, consistency (σ of drill times).
- Runs are deterministic: `createRun(config)` + the recorded keydowns replay to the same result
  (`runKey` is pure). The server-side check in M5 replays them and ignores client scores.
