import { formatChord, type KeyChord, type LayoutId, type Platform } from "@cellrush/engine";
import type { Rng } from "./rng";
import type { Stroke, Task } from "./types";

// ───────────────────────────── hints ─────────────────────────────

/** Human-readable key path, e.g. ["Ctrl+Shift+↓", "Ctrl+Shift+%"] or ["Alt", "H", "0"]. Repeats collapse ("↓ ×3"). */
export function describePath(path: readonly Stroke[], platform: Platform, layout: LayoutId): string[] {
  const labels = path.map((s) => {
    if (s.startsWith("type:")) return `type “${s.slice(5)}”`;
    if (s === "AltLeft") return platform === "mac" ? "⌥" : "Alt";
    const parts = s.split("+");
    const key = parts.pop()!;
    const mods = { ctrl: parts.includes("ctrl"), shift: parts.includes("shift"), alt: parts.includes("alt"), meta: parts.includes("meta") };
    if (key.length === 1 && !mods.ctrl && !mods.meta && !mods.alt && !mods.shift) return key.toUpperCase();
    const chord: KeyChord = key.length === 1 ? { ...mods, char: key } : { ...mods, code: key };
    return formatChord(chord, platform, layout);
  });
  const out: string[] = [];
  for (let i = 0; i < labels.length; ) {
    let j = i;
    while (j < labels.length && labels[j] === labels[i]) j++;
    out.push(j - i > 1 ? `${labels[i]} ×${j - i}` : labels[i]!);
    i = j;
  }
  return out;
}

// ───────────────────────────── spaced repetition (Leitner boxes) ─────────────────────────────

/** Box 0 = keep practising … MAX_BOX = mastered. */
export const MAX_BOX = 4;

export interface LearnRecord {
  box: number;
  seen: number;
  missed: number;
}
export type LearnBoxes = Readonly<Record<string, LearnRecord>>;

export interface LearnOutcome {
  /** The hint was shown before the drill was solved. */
  hinted: boolean;
  skipped: boolean;
  keystrokes: number;
  optimal: number;
}

/** A drill counts as missed if it needed the hint, was skipped, or took extra keys. */
export const isMiss = (o: LearnOutcome) => o.hinted || o.skipped || o.keystrokes > o.optimal;

export function recordOutcome(boxes: LearnBoxes, taskId: string, o: LearnOutcome): LearnBoxes {
  const prev = boxes[taskId] ?? { box: 0, seen: 0, missed: 0 };
  const miss = isMiss(o);
  return {
    ...boxes,
    [taskId]: { box: miss ? 0 : Math.min(MAX_BOX, prev.box + 1), seen: prev.seen + 1, missed: prev.missed + (miss ? 1 : 0) },
  };
}

/** Weight of a drill: missed ones come back most, unseen ones next, mastered ones rarely. */
export function learnWeight(rec: LearnRecord | undefined): number {
  if (!rec) return 6;
  return 2 ** (MAX_BOX - rec.box); // box 0 → 16, box 4 → 1
}

/** Drill picker for Learn mode: weighted by box, never the same drill twice in a row. */
export function learnPicker(getBoxes: () => LearnBoxes) {
  return (rng: Rng, pool: readonly Task[], previous: Task | null): Task => {
    const candidates = pool.length > 1 && previous ? pool.filter((t) => t.id !== previous.id) : pool;
    const boxes = getBoxes();
    const weights = candidates.map((t) => learnWeight(boxes[t.id]));
    let x = rng.next() * weights.reduce((s, w) => s + w, 0);
    for (let i = 0; i < candidates.length; i++) {
      x -= weights[i]!;
      if (x < 0) return candidates[i]!;
    }
    return candidates[candidates.length - 1]!;
  };
}

/** Drills to review (box 0 after at least one miss), most-missed first. */
export function toReview(boxes: LearnBoxes): string[] {
  return Object.entries(boxes)
    .filter(([, r]) => r.box === 0 && r.missed > 0)
    .sort((a, b) => b[1].missed - a[1].missed)
    .map(([id]) => id);
}

export const masteredCount = (boxes: LearnBoxes) => Object.values(boxes).filter((r) => r.box >= MAX_BOX - 1).length;
