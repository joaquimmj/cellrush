import { SHORTCUTS, bindingFor, type Platform } from "@cellrush/engine";
import type { Task } from "./types";

/**
 * Shortcuts that exist on a platform but are not on Microsoft's official page for it
 * (`verified` false). Drills that need one stay playable in practice (Learn mode, a
 * scenario's practice run) but never count for a leaderboard or the Daily.
 */
const UNVERIFIED: Record<Platform, ReadonlySet<string>> = {
  win: new Set(SHORTCUTS.filter((s) => bindingFor(s, "win") && !s.verified.win).map((s) => s.id)),
  mac: new Set(SHORTCUTS.filter((s) => bindingFor(s, "mac") && !s.verified.mac).map((s) => s.id)),
};

/** Registry ids a drill needs on this platform that Microsoft's page does not list. */
export const unverifiedShortcuts = (task: Task, platform: Platform): string[] =>
  task.requires.filter((id) => UNVERIFIED[platform].has(id));

/** Can this drill count for a leaderboard on this platform? */
export const isRankable = (task: Task, platform: Platform): boolean => unverifiedShortcuts(task, platform).length === 0;
