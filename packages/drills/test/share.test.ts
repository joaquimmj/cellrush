import { describe, expect, it } from "vitest";
import {
  DAILY_TASKS, createRun, dailyConfig, dailyNumber, dailySeed, decodeResult, encodeResult, msUntilNextDaily,
  runKey, shareText, strokeToRaws, summarize, utcDate, type RunState, type ShareSummary,
} from "../src";

const sample: ShareSummary = {
  daily: 42, mode: "daily", platform: "win", score: 412, efficiency: 87, tpm: 12.4, completed: 9,
  elapsedMs: 48_300, squares: "ggygxgggyg", date: "2026-12-19",
};

describe("share text (brief §13)", () => {
  it("matches the brief's example exactly", () => {
    expect(shareText(sample)).toBe(
      ["cellrush daily #42 ⏱ 48.3s", "🟩🟩🟨🟩⬛🟩🟩🟩🟨🟩", "score 412 · efficiency 87%", "cellrush.app"].join("\n"),
    );
  });
  it("normal runs name the mode instead of a daily number", () =>
    expect(shareText({ ...sample, daily: null, mode: "60s" }).split("\n")[0]).toBe("cellrush 60s ⏱ 48.3s"));
  it("uses the configured name and domain", () =>
    expect(shareText(sample, "xlrace", "xlrace.io")).toMatch(/^xlrace daily #42[\s\S]*\nxlrace\.io$/));
});

describe("daily", () => {
  it("#1 on the epoch, then +1 per UTC day", () => {
    expect(dailyNumber("2026-11-08")).toBe(1);
    expect(dailyNumber("2026-11-09")).toBe(2);
    expect(dailyNumber("2027-11-08")).toBe(366);
  });
  it("same seed for everyone on a day, a new one the next day", () => {
    expect(dailySeed("2026-11-20")).toBe(dailySeed("2026-11-20"));
    expect(dailySeed("2026-11-20")).not.toBe(dailySeed("2026-11-21"));
  });
  it("UTC date and countdown", () => {
    const t = Date.UTC(2026, 10, 8, 23, 0, 0);
    expect(utcDate(t)).toBe("2026-11-08");
    expect(msUntilNextDaily(t)).toBe(3_600_000);
  });
  it("is 10 drills and identical for two players on the same platform", () => {
    const a = createRun(dailyConfig("2026-11-20", "win", "us"));
    const b = createRun(dailyConfig("2026-11-20", "win", "fr-azerty"));
    expect(a.config.mode).toEqual({ kind: "tasks", count: DAILY_TASKS });
    expect(a.current!.task.id).toBe(b.current!.task.id);
  });
});

function playDaily(): RunState {
  let run = createRun(dailyConfig("2026-11-20", "win", "us"));
  let now = 0;
  for (let i = 0; i < 20 && run.finishedAt === null; i++) {
    const cur = run.current!;
    for (const raw of cur.task.optimal(cur.params).win!.flatMap((s) => strokeToRaws(s, "us"))) run = runKey(run, raw, (now += 200)).run;
  }
  return run;
}

describe("summary + result links", () => {
  it("a full daily summarizes to 10 green squares", () => {
    const s = summarize(playDaily(), { daily: dailyNumber("2026-11-20"), mode: "daily" });
    expect(s.squares).toBe("g".repeat(10));
    expect(s.efficiency).toBe(100);
    expect(shareText(s)).toMatch(/^cellrush daily #13 ⏱ \d+\.\ds\n(🟩){10}\nscore \d+ · efficiency 100%\ncellrush\.app$/u);
  });
  it("encode → decode round-trips", () => expect(decodeResult(encodeResult(sample))).toEqual(sample));
  it("ids are URL-safe", () => expect(encodeResult(sample)).toMatch(/^[A-Za-z0-9_-]+$/));
  it.each(["", "garbage", "eyJ4IjoxfQ", encodeResult({ ...sample, efficiency: 140 }), encodeResult({ ...sample, squares: "<script>" })])(
    "rejects malformed id %#",
    (id) => expect(decodeResult(id)).toBeNull(),
  );
});
