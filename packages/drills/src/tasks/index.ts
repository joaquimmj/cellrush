import type { Task } from "../types";
import { clipboardTasks } from "./clipboard";
import { editingTasks } from "./editing";
import { formattingTasks } from "./formatting";
import { formulaTasks, sheetTasks } from "./formulas";
import { navigationTasks } from "./navigation";
import { rowsColsTasks } from "./rowscols";
import { selectionTasks } from "./selection";

/** Every drill. Add yours in the matching file — see docs/ADDING_A_DRILL.md. */
export const TASKS: readonly Task[] = [
  ...navigationTasks,
  ...selectionTasks,
  ...editingTasks,
  ...formattingTasks,
  ...rowsColsTasks,
  ...clipboardTasks,
  ...formulaTasks,
  ...sheetTasks,
];

export const taskById = (id: string) => TASKS.find((t) => t.id === id);
