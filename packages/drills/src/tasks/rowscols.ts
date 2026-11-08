import { colToLetters } from "@cellrush/engine";
import { at, isReady, makeTable, rawAt, stateOf } from "../data";
import { defineTask, type Task } from "../types";

/** Row/column tasks are checked through the labels that should (or should not) have moved. */
type RowP = { r: number; c: number; label: string; next: string; n?: number };
type ColP = { c: number; r: number; header: string; next: string };

function rowSetup(rng: Parameters<Task["setup"]>[0], ctx: Parameters<Task["setup"]>[1]) {
  const t = makeTable(rng, { rows: [6, 9] });
  const r = rng.int(t.numbers.r1 + 1, t.numbers.r2 - 1);
  const c = t.range.c1;
  const st = stateOf(t.sheet, at(r, rng.int(t.range.c1, t.range.c2)), ctx);
  return { st, r, c, label: rawAt(st, at(r, c)), next: rawAt(st, at(r + 1, c)) };
}

function colSetup(rng: Parameters<Task["setup"]>[0], ctx: Parameters<Task["setup"]>[1]) {
  const t = makeTable(rng);
  const c = rng.int(t.numbers.c1, t.numbers.c2 - 1);
  const r = t.range.r1;
  // Period headers (Q1..Q4, FY23..) are unique, so the check can tell columns apart.
  const st = stateOf(t.sheet, at(rng.int(t.numbers.r1, t.numbers.r2), c), ctx);
  return { st, c, r, header: rawAt(st, at(r, c)), next: rawAt(st, at(r, c + 1)) };
}

export const rowsColsTasks: Task[] = [
  defineTask<RowP>({
    id: "insert-row",
    category: "rows-cols",
    difficulty: 2,
    prompt: (p) => `Insert an empty row above row ${p.r + 1} (“${p.label}”)`,
    setup(rng, ctx) {
      const s = rowSetup(rng, ctx);
      return { state: s.st, params: { r: s.r, c: s.c, label: s.label, next: s.next } };
    },
    check: (st, p) => isReady(st) && rawAt(st, at(p.r, p.c)) === "" && rawAt(st, at(p.r + 1, p.c)) === p.label,
    optimal: () => ({ win: ["shift+Space", "ctrl+shift+Equal"], mac: ["shift+Space", "ctrl+shift+Equal"] }),
    requires: ["select-row", "insert-cells"],
  }),
  defineTask<RowP>({
    id: "insert-two-rows",
    category: "rows-cols",
    difficulty: 3,
    prompt: (p) => `Insert two empty rows above row ${p.r + 1} (“${p.label}”)`,
    setup(rng, ctx) {
      const s = rowSetup(rng, ctx);
      return { state: s.st, params: { r: s.r, c: s.c, label: s.label, next: s.next } };
    },
    check: (st, p) => isReady(st) && rawAt(st, at(p.r, p.c)) === "" && rawAt(st, at(p.r + 1, p.c)) === "" && rawAt(st, at(p.r + 2, p.c)) === p.label,
    optimal: () => ({ win: ["shift+Space", "shift+ArrowDown", "ctrl+shift+Equal"], mac: ["shift+Space", "shift+ArrowDown", "ctrl+shift+Equal"] }),
    requires: ["select-row", "extend-down", "insert-cells"],
  }),
  defineTask<RowP>({
    id: "delete-row",
    category: "rows-cols",
    difficulty: 2,
    prompt: (p) => `Delete row ${p.r + 1} (“${p.label}”)`,
    setup(rng, ctx) {
      const s = rowSetup(rng, ctx);
      return { state: s.st, params: { r: s.r, c: s.c, label: s.label, next: s.next } };
    },
    check: (st, p) => isReady(st) && rawAt(st, at(p.r, p.c)) === p.next,
    optimal: () => ({ win: ["shift+Space", "ctrl+Minus"], mac: ["shift+Space", "ctrl+Minus"] }),
    requires: ["select-row", "delete-cells"],
  }),
  defineTask<RowP>({
    id: "delete-row-dialog",
    category: "rows-cols",
    difficulty: 2,
    prompt: (p) => `Delete the entire row of the active cell (row ${p.r + 1}) using the Delete dialog`,
    setup(rng, ctx) {
      const s = rowSetup(rng, ctx);
      return { state: s.st, params: { r: s.r, c: s.c, label: s.label, next: s.next } };
    },
    check: (st, p) => isReady(st) && rawAt(st, at(p.r, p.c)) === p.next,
    optimal: () => ({ win: ["ctrl+Minus", "r", "Enter"], mac: ["ctrl+Minus", "r", "Enter"] }),
    requires: ["delete-cells"],
  }),
  defineTask<ColP>({
    id: "insert-column",
    category: "rows-cols",
    difficulty: 2,
    prompt: (p) => `Insert an empty column before column ${colToLetters(p.c)} (“${p.header}”)`,
    setup(rng, ctx) {
      const s = colSetup(rng, ctx);
      return { state: s.st, params: { c: s.c, r: s.r, header: s.header, next: s.next } };
    },
    check: (st, p) => isReady(st) && rawAt(st, at(p.r, p.c)) === "" && rawAt(st, at(p.r, p.c + 1)) === p.header,
    optimal: () => ({ win: ["ctrl+Space", "ctrl+shift+Equal"], mac: ["ctrl+Space", "ctrl+shift+Equal"] }),
    requires: ["select-column", "insert-cells"],
  }),
  defineTask<ColP>({
    id: "delete-column",
    category: "rows-cols",
    difficulty: 2,
    prompt: (p) => `Delete column ${colToLetters(p.c)} (“${p.header}”)`,
    setup(rng, ctx) {
      const s = colSetup(rng, ctx);
      return { state: s.st, params: { c: s.c, r: s.r, header: s.header, next: s.next } };
    },
    check: (st, p) => isReady(st) && rawAt(st, at(p.r, p.c)) === p.next,
    optimal: () => ({ win: ["ctrl+Space", "ctrl+Minus"], mac: ["ctrl+Space", "ctrl+Minus"] }),
    requires: ["select-column", "delete-cells"],
  }),
];
