import { parseUserAgent, type BrowserEnv, type RawKey } from "@cellrush/engine";

interface KeyboardLockApi {
  lock(keys?: string[]): Promise<void>;
  unlock(): void;
}
const kb = (): KeyboardLockApi | undefined => (navigator as Navigator & { keyboard?: KeyboardLockApi }).keyboard;

export function currentEnv(): BrowserEnv {
  return parseUserAgent(navigator.userAgent, typeof kb()?.lock === "function");
}

/** Fullscreen + Keyboard Lock (Chromium). Resolves true when the lock is active. */
export async function enterFocusMode(): Promise<boolean> {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    const api = kb();
    if (!api?.lock) return false;
    await api.lock();
    return true;
  } catch {
    return false;
  }
}

export async function exitFocusMode(): Promise<void> {
  kb()?.unlock();
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
}

export function toRaw(e: KeyboardEvent): RawKey {
  return { code: e.code, key: e.key, ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey };
}
