import { rangeOf, type CellAddr, type Range } from "./address";
import type { Dir } from "./navigation";
import { createSheet } from "./sheet";
import type { CellFormat, NumberFormat, Sheet } from "./types";

export type Mode = "ready" | "enter" | "edit";
export type DateStyle = "mdy" | "dmy";

export interface Editor {
  text: string;
  caret: number;
}

/** `anchor`..`focus` is the selected rectangle; `active` is the white cell inside it. */
export interface Selection {
  active: CellAddr;
  anchor: CellAddr;
  focus: CellAddr;
}

/** One undoable step. Sheets are immutable, so storing both versions is cheap (structural sharing). */
export interface Patch {
  sheetIndex: number;
  before: Sheet;
  after: Sheet;
  selBefore: Selection;
  selAfter: Selection;
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
  | { type: "toggleShowFormulas" };

export type ActionType = Action["type"];

export const DEFAULT_OPTIONS: EngineOptions = { pageRows: 20, today: "2026-01-01", dateStyle: "mdy", undoLimit: 100 };

export function createState(init: { sheets?: Sheet[]; active?: CellAddr; options?: Partial<EngineOptions> } = {}): GridState {
  const a = init.active ?? { r: 0, c: 0 };
  return {
    sheets: init.sheets ?? [createSheet()],
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
