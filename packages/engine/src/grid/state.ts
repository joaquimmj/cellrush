import { recalc } from "../formula/recalc";
import { rangeOf, type CellAddr, type Range } from "./address";
import type { Dir } from "./navigation";
import { createSheet } from "./sheet";
import type { Cell, CellFormat, NumberFormat, Sheet } from "./types";

export type Mode = "ready" | "enter" | "edit";
export type DateStyle = "mdy" | "dmy";

export interface Editor {
  text: string;
  caret: number;
  /**
   * Point mode: while typing a formula, arrow keys pick a cell instead of committing.
   * `start..end` is where the picked reference sits in `text`.
   */
  point?: { anchor: CellAddr; focus: CellAddr; start: number; end: number };
}

export interface Clipboard {
  sheetIndex: number;
  range: Range;
  cut: boolean;
  /** Snapshot keyed by "dr:dc" offset from the range's top-left. */
  cells: Readonly<Record<string, Cell>>;
}

export type PasteMode = "all" | "values" | "formulas" | "formats";
export type InsertChoice = "row" | "col";

/** Small keyboard dialogs (Paste Special, Insert, Delete). */
export type Dialog =
  | { kind: "pasteSpecial"; choice: PasteMode }
  | { kind: "insert"; choice: InsertChoice }
  | { kind: "delete"; choice: InsertChoice };

/** `anchor`..`focus` is the selected rectangle; `active` is the white cell inside it. */
export interface Selection {
  active: CellAddr;
  anchor: CellAddr;
  focus: CellAddr;
}

/** One undoable step. Sheets are immutable, so storing both versions is cheap (structural sharing). */
export interface Patch {
  before: readonly Sheet[];
  after: readonly Sheet[];
  indexBefore: number;
  indexAfter: number;
  selBefore: Selection;
  selAfter: Selection;
  circularBefore: readonly string[];
  circularAfter: readonly string[];
}

export interface EngineOptions {
  /** Rows moved by PgUp/PgDn. */
  pageRows: number;
  /** "Today" as YYYY-MM-DD. Injected so runs replay identically (Daily, server validation). */
  today: string;
  dateStyle: DateStyle;
  undoLimit: number;
}

export interface GridState {
  sheets: readonly Sheet[];
  sheetIndex: number;
  sel: Selection;
  mode: Mode;
  editor: Editor | null;
  undo: readonly Patch[];
  redo: readonly Patch[];
  /** Last repeatable action, replayed by F4 / Ctrl+Y. */
  lastAction: Action | null;
  /** Ribbon keytip sequence typed so far (Alt → H → …); null when not in keytip mode. */
  keytip: readonly string[] | null;
  showFormulas: boolean;
  /** Copied/cut range ("marching ants"), cleared by Esc or by editing a cell. */
  clipboard: Clipboard | null;
  dialog: Dialog | null;
  /** Cells in a circular reference ("Sheet1!B3"); empty when there is none. */
  circular: readonly string[];
  options: EngineOptions;
}

export type Action =
  | { type: "move"; dir: Dir; extend?: boolean; jump?: boolean }
  | { type: "home"; extend?: boolean }
  | { type: "end" }
  | { type: "ctrlHome"; extend?: boolean }
  | { type: "ctrlEnd"; extend?: boolean }
  | { type: "page"; dir: "up" | "down"; extend?: boolean }
  | { type: "selectRow" }
  | { type: "selectColumn" }
  | { type: "selectAll" }
  | { type: "input"; text: string }
  | { type: "backspace" }
  | { type: "deleteKey" }
  | { type: "editCell" }
  | { type: "cancel" }
  | { type: "commit"; dir: Dir }
  | { type: "commitAll" }
  | { type: "newline" }
  | { type: "clear" }
  | { type: "fillDown" }
  | { type: "fillRight" }
  | { type: "insertDate" }
  | { type: "copyFromAbove" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "repeat" }
  | { type: "redoOrRepeat" }
  | { type: "toggleFormat"; prop: "bold" | "italic" | "underline" }
  | { type: "setFormat"; patch: Partial<CellFormat> }
  | { type: "numberFormat"; format: NumberFormat }
  | { type: "decimals"; delta: 1 | -1 }
  | { type: "autofitColumn" }
  | { type: "toggleShowFormulas" }
  // ── M2 ──
  | { type: "copy" }
  | { type: "cut" }
  | { type: "paste" }
  | { type: "pasteSpecialDialog" }
  | { type: "pasteSpecial"; mode: PasteMode }
  | { type: "dialogKey"; key: string }
  | { type: "dialogConfirm" }
  | { type: "insertCells" }
  | { type: "deleteCells" }
  | { type: "insertEntire"; axis: InsertChoice }
  | { type: "deleteEntire"; axis: InsertChoice }
  | { type: "autoSum" }
  | { type: "toggleAnchor" }
  | { type: "nextSheet" }
  | { type: "prevSheet" }
  | { type: "insertSheet" };

export type ActionType = Action["type"];

export const DEFAULT_OPTIONS: EngineOptions = { pageRows: 20, today: "2026-01-01", dateStyle: "mdy", undoLimit: 100 };

export function createState(init: { sheets?: Sheet[]; active?: CellAddr; options?: Partial<EngineOptions> } = {}): GridState {
  const a = init.active ?? { r: 0, c: 0 };
  const { sheets, circular } = recalc(init.sheets ?? [createSheet()]);
  return {
    sheets,
    clipboard: null,
    dialog: null,
    circular,
    sheetIndex: 0,
    sel: { active: a, anchor: a, focus: a },
    mode: "ready",
    editor: null,
    undo: [],
    redo: [],
    lastAction: null,
    keytip: null,
    showFormulas: false,
    options: { ...DEFAULT_OPTIONS, ...init.options },
  };
}

export const activeSheet = (st: GridState): Sheet => st.sheets[st.sheetIndex]!;
export const selRange = (sel: Selection): Range => rangeOf(sel.anchor, sel.focus);
export const collapsed = (a: CellAddr): Selection => ({ active: a, anchor: a, focus: a });
