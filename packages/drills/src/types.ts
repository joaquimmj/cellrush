import type { GridState, Range, ShortcutCategory } from "@cellrush/engine";
import type { Rng } from "./rng";

export interface SetupContext {
  /** "Today" for the run (YYYY-MM-DD), so Ctrl+; is deterministic. */
  today: string;
}

export interface TaskInstance<P> {
  state: GridState;
  params: P;
  /** Cells to highlight next to the prompt (optional). */
  target?: Range;
}

/** Key strokes in a compact text form: "ctrl+shift+ArrowDown", "F4", "b" (with mods), "type:=SUM(", "AltLeft". */
export type Stroke = string;

export interface OptimalPath {
  win: Stroke[] | null;
  /** null = not doable on Mac (e.g. Windows ribbon keytips). Never invent a Mac path. */
  mac: Stroke[] | null;
}

/**
 * A drill. Data-first and deterministic: `setup` uses only `rng`, `check` only looks at the state.
 * Any key path that reaches the goal passes; `optimal` is the shortest known path (efficiency, hints).
 */
export interface Task<P = any> {
  id: string;
  category: ShortcutCategory;
  difficulty: 1 | 2 | 3;
  prompt(p: P): string;
  setup(rng: Rng, ctx: SetupContext): TaskInstance<P>;
  check(st: GridState, p: P): boolean;
  optimal(p: P): OptimalPath;
  /** Registry shortcut ids the optimal path uses (capture-matrix filtering, Learn hints). */
  requires: string[];
  /** The goal is an editing state (e.g. "enter Edit mode"), so don't wait for Ready mode. */
  allowEditing?: boolean;
}

export const defineTask = <P>(t: Task<P>): Task<P> => t;
