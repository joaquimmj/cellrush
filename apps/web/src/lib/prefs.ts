import type { LayoutId, Platform } from "@cellrush/engine";
import type { RunMode, ShareSummary } from "@cellrush/drills";

/** Per-viewer conveniences in localStorage. Every access is guarded: storage can be blocked. */
function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private window / blocked storage */
  }
}

export interface Prefs {
  platform?: Platform;
  layout?: LayoutId;
  mode: RunMode;
}

const PREFS = "cellrush.prefs.v1";
export const loadPrefs = (): Prefs => read<Prefs>(PREFS, { mode: { kind: "time", seconds: 60 } });
export const savePrefs = (p: Prefs) => write(PREFS, p);

export const modeKey = (m: RunMode, platform: Platform) => `${m.kind === "time" ? `${m.seconds}s` : `${m.count}t`}-${platform}`;

const PB = "cellrush.pb.v1";
export function personalBest(key: string): number {
  return read<Record<string, number>>(PB, {})[key] ?? 0;
}
/** Save the score if it beats the best for this mode; returns true for a new PB. */
export function recordScore(key: string, score: number): boolean {
  const all = read<Record<string, number>>(PB, {});
  if (score <= (all[key] ?? 0)) return false;
  write(PB, { ...all, [key]: score });
  return true;
}

/** Give the keyboard back to the page after a control was used with the mouse. */
export function releaseFocus() {
  const el = document.activeElement;
  if (el instanceof HTMLElement && el !== document.body) el.blur();
}

// ── Daily: the first finished attempt per UTC day and platform is the ranked one ──
const DAILY = "cellrush.daily.v1";
const dailyKey = (date: string, platform: Platform) => `${date}-${platform}`;
export const dailyAttempt = (date: string, platform: Platform): ShareSummary | null =>
  read<Record<string, ShareSummary>>(DAILY, {})[dailyKey(date, platform)] ?? null;
/** Stores the attempt only if none exists yet; returns true if this one is the ranked attempt. */
export function saveDailyAttempt(s: ShareSummary): boolean {
  const all = read<Record<string, ShareSummary>>(DAILY, {});
  const k = dailyKey(s.date, s.platform);
  if (all[k]) return false;
  write(DAILY, { ...all, [k]: s });
  return true;
}
