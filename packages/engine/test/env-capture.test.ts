import { describe, expect, it } from "vitest";
import { CAPTURE_COMBOS, capturability, defaultPlatform, mergeResult, parseUserAgent, type CaptureMatrix } from "../src";

const UA = {
  chromeWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  edgeWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  firefoxMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:132.0) Gecko/20100101 Firefox/132.0",
  safariMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
};

describe("parseUserAgent", () => {
  it("chrome windows", () => expect(parseUserAgent(UA.chromeWin)).toMatchObject({ browser: "chrome", os: "windows", browserVersion: "130", mobile: false }));
  it("edge before chrome", () => expect(parseUserAgent(UA.edgeWin).browser).toBe("edge"));
  it("firefox mac", () => expect(parseUserAgent(UA.firefoxMac)).toMatchObject({ browser: "firefox", os: "macos" }));
  it("safari mac", () => expect(parseUserAgent(UA.safariMac)).toMatchObject({ browser: "safari", os: "macos", browserVersion: "18" }));
  it("iphone is mobile, not macos", () => expect(parseUserAgent(UA.iphone)).toMatchObject({ mobile: true, os: "other" }));
  it("default platform", () => {
    expect(defaultPlatform(parseUserAgent(UA.safariMac))).toBe("mac");
    expect(defaultPlatform(parseUserAgent(UA.chromeWin))).toBe("win");
  });
});

describe("capture combos", () => {
  it("ids are unique", () => {
    const ids = CAPTURE_COMBOS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("ids are prefixed by platform", () => {
    for (const c of CAPTURE_COMBOS) expect(c.id.startsWith(`${c.platform}.`)).toBe(true);
  });
});

describe("capturability", () => {
  const chrome = { ...parseUserAgent(UA.chromeWin), keyboardLockSupported: true };
  const firefox = parseUserAgent(UA.firefoxMac);
  const base = { browser: "chrome" as const, browserVersion: "130", os: "windows" as const, testedAt: "2026-11-08" };
  const matrix: CaptureMatrix = {
    version: 1,
    results: [
      { ...base, mode: "normal", captured: ["win.ctrl+d"], blocked: ["win.ctrl+w", "win.ctrl+n"] },
      { ...base, mode: "lock", captured: ["win.ctrl+d", "win.ctrl+w"], blocked: ["win.ctrl+n"] },
    ],
  };
  it("ok when captured normally", () => expect(capturability("win.ctrl+d", chrome, matrix)).toBe("ok"));
  it("needs-lock when only lock captures", () => expect(capturability("win.ctrl+w", chrome, matrix)).toBe("needs-lock"));
  it("blocked when neither captures", () => expect(capturability("win.ctrl+n", chrome, matrix)).toBe("blocked"));
  it("lock result ignored when API unsupported", () =>
    expect(capturability("win.ctrl+w", { ...chrome, keyboardLockSupported: false }, matrix)).toBe("blocked"));
  it("unknown for untested env", () => expect(capturability("win.ctrl+w", firefox, matrix)).toBe("unknown"));
  it("shipped matrix is valid and starts empty-safe", () => expect(capturability("win.ctrl+w", chrome)).toMatch(/ok|needs-lock|blocked|unknown/));
  it("mergeResult replaces same env", () => {
    const next = mergeResult(matrix, { ...base, mode: "normal", captured: ["win.ctrl+w"], blocked: [] });
    expect(next.results).toHaveLength(2);
    expect(capturability("win.ctrl+w", chrome, next)).toBe("ok");
  });
});
