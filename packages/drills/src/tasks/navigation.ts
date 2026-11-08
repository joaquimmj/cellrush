import { colToLetters, createSheet, fillFromRows, type CellAddr } from "@cellrush/engine";
import { A1, at, company, cursorAt, isReady, makeTable, stateOf, times } from "../data";
import { defineTask, type Task } from "../types";

type Target = { from: CellAddr; to: CellAddr; col?: string };
const arrive = (st: Parameters<Task["check"]>[0], p: Target) => isReady(st) && cursorAt(st, p.to);

const jump = (dir: "Up" | "Down" | "Left" | "Right", n = 1) => ({
  win: times(n, `ctrl+Arrow${dir}`),
  mac: times(n, `meta+Arrow${dir}`),
});

export const navigationTasks: Task[] = [
  defineTask<Target>({
    id: "jump-bottom",
    category: "navigation",
    difficulty: 1,
    prompt: (p) => `Jump to the last row of data in column ${p.col}`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      const c = rng.int(t.numbers.c1, t.numbers.c2);
      const from = at(t.range.r1, c);
      return { state: stateOf(t.sheet, from, ctx), params: { from, to: at(t.range.r2, c), col: colToLetters(c) } };
    },
    check: arrive,
    optimal: () => jump("Down"),
    requires: ["jump-down"],
  }),
  defineTask<Target>({
    id: "jump-top",
    category: "navigation",
    difficulty: 1,
    prompt: (p) => `Jump to the header of column ${p.col}`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      const c = rng.int(t.numbers.c1, t.numbers.c2);
      const from = at(t.range.r2, c);
      return { state: stateOf(t.sheet, from, ctx), params: { from, to: at(t.range.r1, c), col: colToLetters(c) } };
    },
    check: arrive,
    optimal: () => jump("Up"),
    requires: ["jump-up"],
  }),
  defineTask<Target>({
    id: "jump-right",
    category: "navigation",
    difficulty: 1,
    prompt: (p) => `Jump to the last column of row ${p.to.r + 1}`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      const r = rng.int(t.numbers.r1, t.numbers.r2);
      const from = at(r, t.range.c1);
      return { state: stateOf(t.sheet, from, ctx), params: { from, to: at(r, t.range.c2) } };
    },
    check: arrive,
    optimal: () => jump("Right"),
    requires: ["jump-right"],
  }),
  defineTask<Target>({
    id: "jump-left",
    category: "navigation",
    difficulty: 1,
    prompt: (p) => `Jump back to the label at the start of row ${p.to.r + 1}`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      const r = rng.int(t.numbers.r1, t.numbers.r2);
      const from = at(r, t.range.c2);
      return { state: stateOf(t.sheet, from, ctx), params: { from, to: at(r, t.range.c1) } };
    },
    check: arrive,
    optimal: () => jump("Left"),
    requires: ["jump-left"],
  }),
  defineTask<Target>({
    id: "jump-next-table",
    category: "navigation",
    difficulty: 2,
    prompt: (p) => `Jump down to the header of the next table (${A1(p.to)})`,
    setup(rng, ctx) {
      const t1 = makeTable(rng, { origin: at(1, 1), rows: [4, 6] });
      const gap = rng.int(2, 5);
      const t2 = makeTable(rng, { origin: at(t1.range.r2 + 1 + gap, 1), sheet: t1.sheet, rows: [3, 6] });
      const from = at(t1.range.r2, 1);
      return { state: stateOf(t2.sheet, from, ctx), params: { from, to: at(t2.range.r1, 1) } };
    },
    check: arrive,
    optimal: () => jump("Down"),
    requires: ["jump-down"],
  }),
  defineTask<Target>({
    id: "jump-second-table-end",
    category: "navigation",
    difficulty: 2,
    prompt: (p) => `Go to the last row of the second table (${A1(p.to)})`,
    setup(rng, ctx) {
      const t1 = makeTable(rng, { origin: at(1, 1), rows: [4, 6] });
      const t2 = makeTable(rng, { origin: at(t1.range.r2 + rng.int(3, 5), 1), sheet: t1.sheet, rows: [3, 6] });
      const from = at(1, 1);
      return { state: stateOf(t2.sheet, from, ctx), params: { from, to: at(t2.range.r2, 1) } };
    },
    check: arrive,
    optimal: () => jump("Down", 3),
    requires: ["jump-down"],
  }),
  defineTask<Target>({
    id: "table-corner",
    category: "navigation",
    difficulty: 2,
    prompt: (p) => `Go to the bottom-right corner of the table (${A1(p.to)})`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      return { state: stateOf(t.sheet, t.origin, ctx), params: { from: t.origin, to: at(t.range.r2, t.range.c2) } };
    },
    check: arrive,
    optimal: () => ({ win: ["ctrl+ArrowDown", "ctrl+ArrowRight"], mac: ["meta+ArrowDown", "meta+ArrowRight"] }),
    requires: ["jump-down", "jump-right"],
  }),
  defineTask<Target>({
    id: "go-home",
    category: "navigation",
    difficulty: 1,
    prompt: () => "Go back to cell A1",
    setup(rng, ctx) {
      const t = makeTable(rng);
      const from = at(rng.int(t.numbers.r1, t.numbers.r2), rng.int(t.numbers.c1, t.numbers.c2));
      return { state: stateOf(t.sheet, from, ctx), params: { from, to: at(0, 0) } };
    },
    check: arrive,
    optimal: () => ({ win: ["ctrl+Home"], mac: ["ctrl+Home"] }),
    requires: ["go-home"],
  }),
  defineTask<Target>({
    id: "go-last-cell",
    category: "navigation",
    difficulty: 1,
    prompt: (p) => `Go to the last used cell of the sheet (${A1(p.to)})`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      return { state: stateOf(t.sheet, at(0, 0), ctx), params: { from: at(0, 0), to: at(t.range.r2, t.range.c2) } };
    },
    check: arrive,
    optimal: () => ({ win: ["ctrl+End"], mac: ["ctrl+End"] }),
    requires: ["go-last-cell"],
  }),
  defineTask<Target>({
    id: "row-start",
    category: "navigation",
    difficulty: 1,
    prompt: (p) => `Go to the start of row ${p.to.r + 1} (column A)`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      const r = rng.int(t.numbers.r1, t.numbers.r2);
      const from = at(r, rng.int(Math.max(2, t.numbers.c1), t.numbers.c2));
      return { state: stateOf(t.sheet, from, ctx), params: { from, to: at(r, 0) } };
    },
    check: arrive,
    optimal: () => ({ win: ["Home"], mac: ["Home"] }),
    requires: ["row-start"],
  }),
  defineTask<Target & { path: string[] }>({
    id: "move-to-cell",
    category: "navigation",
    difficulty: 1,
    prompt: (p) => `Move to ${A1(p.to)}`,
    setup(rng, ctx) {
      const t = makeTable(rng);
      const from = at(rng.int(t.numbers.r1, t.numbers.r2), rng.int(t.numbers.c1, t.numbers.c2));
      let dr = rng.int(-2, 2);
      let dc = rng.int(-2, 2);
      if (dr === 0 && dc === 0) dr = 1;
      const to = at(Math.max(0, from.r + dr), Math.max(0, from.c + dc));
      dr = to.r - from.r;
      dc = to.c - from.c;
      const path = [...times(Math.abs(dr), dr > 0 ? "ArrowDown" : "ArrowUp"), ...times(Math.abs(dc), dc > 0 ? "ArrowRight" : "ArrowLeft")];
      return { state: stateOf(t.sheet, from, ctx), params: { from, to, path } };
    },
    check: arrive,
    optimal: (p) => ({ win: p.path, mac: p.path }),
    requires: ["move-down"],
  }),
  defineTask<Target>({
    id: "page-down",
    category: "navigation",
    difficulty: 1,
    prompt: (p) => `Move down one screen (to ${A1(p.to)})`,
    setup(rng, ctx) {
      const sheet = fillFromRows(createSheet(), [[company(rng)]]);
      const from = at(rng.int(0, 8), rng.int(0, 4));
      return { state: stateOf(sheet, from, ctx), params: { from, to: at(from.r + 20, from.c) } };
    },
    check: arrive,
    optimal: () => ({ win: ["PageDown"], mac: ["PageDown"] }),
    requires: ["page-down"],
  }),
];
