import type { Platform } from "./types";

export type BrowserId = "chrome" | "edge" | "firefox" | "safari" | "other";
export type OsId = "windows" | "macos" | "linux" | "other";

export interface BrowserEnv {
  browser: BrowserId;
  browserVersion: string;
  os: OsId;
  mobile: boolean;
  /** Keyboard Lock API exists (Chromium only). */
  keyboardLockSupported: boolean;
}

export function parseUserAgent(ua: string, keyboardLockSupported = false): BrowserEnv {
  let browser: BrowserId = "other";
  let version = "";
  const pick = (re: RegExp) => ua.match(re)?.[1] ?? "";
  if (/Edg\//.test(ua)) { browser = "edge"; version = pick(/Edg\/([\d.]+)/); }
  else if (/Firefox\//.test(ua)) { browser = "firefox"; version = pick(/Firefox\/([\d.]+)/); }
  else if (/(Chrome|CriOS)\//.test(ua)) { browser = "chrome"; version = pick(/(?:Chrome|CriOS)\/([\d.]+)/); }
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) { browser = "safari"; version = pick(/Version\/([\d.]+)/); }

  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  let os: OsId = "other";
  if (/Windows/.test(ua)) os = "windows";
  else if (/Mac OS X|Macintosh/.test(ua) && !/iPhone|iPad/.test(ua)) os = "macos";
  else if (/Linux/.test(ua) && !/Android/.test(ua)) os = "linux";

  return { browser, browserVersion: version.split(".")[0] ?? "", os, mobile, keyboardLockSupported };
}

export function defaultPlatform(env: BrowserEnv): Platform {
  return env.os === "macos" ? "mac" : "win";
}
