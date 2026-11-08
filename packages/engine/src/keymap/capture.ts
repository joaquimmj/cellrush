import type { BrowserEnv, BrowserId, OsId } from "./env";
import matrixJson from "./capture-matrix.json";

export type CaptureMode = "normal" | "lock";

export interface CaptureResult {
  browser: BrowserId;
  browserVersion: string;
  os: OsId;
  mode: CaptureMode;
  testedAt: string;
  captured: string[];
  blocked: string[];
}

export interface CaptureMatrix {
  version: 1;
  note?: string;
  results: CaptureResult[];
}

export const CAPTURE_MATRIX = matrixJson as CaptureMatrix;

/**
 * - ok: reaches the page in a normal tab
 * - needs-lock: only reaches the page in fullscreen + Keyboard Lock
 * - blocked: never reaches the page on this browser/OS
 * - unknown: no measurement yet (treated as playable)
 */
export type Capturability = "ok" | "needs-lock" | "blocked" | "unknown";

function find(m: CaptureMatrix, env: BrowserEnv, mode: CaptureMode): CaptureResult[] {
  return m.results.filter((r) => r.browser === env.browser && r.os === env.os && r.mode === mode);
}

export function capturability(comboId: string, env: BrowserEnv, matrix: CaptureMatrix = CAPTURE_MATRIX): Capturability {
  const normal = find(matrix, env, "normal");
  const lock = env.keyboardLockSupported ? find(matrix, env, "lock") : [];
  const caught = (rs: CaptureResult[]) => rs.some((r) => r.captured.includes(comboId));
  const missed = (rs: CaptureResult[]) => rs.some((r) => r.blocked.includes(comboId));
  if (caught(normal)) return "ok";
  if (caught(lock)) return "needs-lock";
  if (missed(normal) && (lock.length === 0 ? true : missed(lock))) return "blocked";
  return "unknown";
}

/** Merge a newly exported result into a matrix (replaces the same browser/os/mode/version). */
export function mergeResult(matrix: CaptureMatrix, result: CaptureResult): CaptureMatrix {
  const keep = matrix.results.filter(
    (r) => !(r.browser === result.browser && r.os === result.os && r.mode === result.mode && r.browserVersion === result.browserVersion),
  );
  return { ...matrix, results: [...keep, result] };
}
