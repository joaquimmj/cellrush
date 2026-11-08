import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { dailyConfig, scoreRun, utcDate, type RunConfig } from "@cellrush/drills";
import { ANON_KEY, API_URL, admin, cleanup, newUser, playHuman, subOf, submit } from "./helpers";

afterAll(cleanup);

const timed = (seed: number): RunConfig => ({ seed, mode: { kind: "time", seconds: 30 }, platform: "win", layout: "us", today: utcDate(Date.now()) });

describe("submit-run: the server's score is the only score", () => {
  it("an honest run is replayed, scored exactly like the client, stored and ranked", async () => {
    const { client, token } = await newUser();
    const run = playHuman(timed(11), 1);
    const res = await submit(token, subOf(run));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ranked: true, flags: [] });
    expect(res.body!.summary.score).toBe(scoreRun(run).score);
    const { data } = await client.from("runs").select("score, ranked, mode, squares").eq("id", res.body!.id).single();
    expect(data).toMatchObject({ score: scoreRun(run).score, ranked: true, mode: "30s" });
  });

  it("TAMPERED: a client-claimed score is ignored; doctored keystrokes score what they actually do", async () => {
    const { client, token } = await newUser();
    const run = playHuman(timed(12), 2);
    const honest = scoreRun(run).score;
    const sub = subOf(run);
    const doctored = { ...sub, score: 999_999, efficiency: 1, tpm: 500, events: sub.events.filter((_, i) => i % 4 !== 2) };
    const res = await submit(token, doctored);
    expect(res.status).toBe(200);
    const { data } = await client.from("runs").select("score").eq("id", res.body!.id).single();
    expect(data!.score).not.toBe(999_999);
    expect(data!.score).toBeLessThan(honest);
    expect(data!.score).toBe(res.body!.summary.score);
  });

  it("TAMPERED: a sped-up timeline is stored as flagged, unranked, and queued for review", async () => {
    const { token } = await newUser();
    const sub = subOf(playHuman({ ...timed(13), mode: { kind: "time", seconds: 60 } }, 3));
    const res = await submit(token, { ...sub, events: sub.events.map((e) => ({ ...e, t: Math.round(e.t / 10) })) });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ranked: false });
    expect(res.body!.flags).toContain("inhuman-speed");
    const { data: flags } = await admin.from("flags").select("reason").eq("run_id", res.body!.id);
    expect(flags!.map((f) => f.reason)).toContain("inhuman-speed");
  });

  it("malformed runs are refused with a reason", async () => {
    const { token } = await newUser();
    expect((await submit(token, "{not json")).status).toBe(400);
    const res = await submit(token, { ...subOf(playHuman(timed(14), 4)), mode: { kind: "time", seconds: 45 } });
    expect(res).toMatchObject({ status: 422, body: { error: "bad mode" } });
  });

  it("needs a signed-in user with a profile", async () => {
    const sub = subOf(playHuman(timed(15), 5));
    expect((await submit(null, sub)).status).toBe(401);
    const { token } = await newUser(false);
    expect((await submit(token, sub)).status).toBe(403);
  });

  it("only the first daily attempt is stored", async () => {
    const { token } = await newUser();
    const today = utcDate(Date.now());
    const first = await submit(token, subOf(playHuman(dailyConfig(today, "win", "us"), 6), true));
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ ranked: true, summary: { daily: expect.any(Number) } });
    const second = await submit(token, subOf(playHuman(dailyConfig(today, "win", "us"), 7), true));
    expect(second).toMatchObject({ status: 409 });
  });

  it("rate-limits an account to 6 runs a minute", async () => {
    const { token } = await newUser();
    const sub = subOf(playHuman(timed(16), 8));
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await submit(token, sub)).status);
    expect(statuses.slice(0, 6).every((s) => s === 200)).toBe(true);
    expect(statuses[6]).toBe(429);
  });
});

describe("row level security", () => {
  it("clients cannot write runs directly", async () => {
    const { client, id } = await newUser();
    const { error } = await client.from("runs").insert({
      user_id: id, mode: "60s", platform: "win", layout: "us", seed: 1, played_on: "2026-11-08",
      score: 99999, tpm: 99, efficiency: 1, completed: 99, elapsed_ms: 60000, squares: "", ranked: true, events: [],
    });
    expect(error).not.toBeNull();
  });

  it("clients cannot raise their own stored score", async () => {
    const { client, token } = await newUser();
    const res = await submit(token, subOf(playHuman(timed(17), 9)));
    await client.from("runs").update({ score: 99999 }).eq("id", res.body!.id);
    const { data } = await admin.from("runs").select("score").eq("id", res.body!.id).single();
    expect(data!.score).toBe(res.body!.summary.score);
  });

  it("clients cannot unban themselves or approve their own school", async () => {
    const { client, id } = await newUser();
    await admin.from("profiles").update({ banned: true }).eq("id", id);
    await client.from("profiles").update({ banned: false, school_other_approved: true, school_other: "My Uni" }).eq("id", id);
    const { data } = await admin.from("profiles").select("banned, school_other_approved").eq("id", id).single();
    expect(data).toMatchObject({ banned: true, school_other_approved: false });
  });

  it("keystrokes are never readable by clients", async () => {
    const { client, token } = await newUser();
    const res = await submit(token, subOf(playHuman(timed(18), 10)));
    const { error } = await client.from("runs").select("events").eq("id", res.body!.id);
    expect(error).not.toBeNull();
  });

  it("offensive display names are refused", async () => {
    const { client, id } = await newUser(false);
    const { error } = await client.from("profiles").insert({ id, display_name: "big merde" });
    expect(error).not.toBeNull();
  });
});

describe("leaderboards", () => {
  it("show ranked runs with public fields only; flagged runs and banned players are hidden", async () => {
    const good = await newUser();
    const cheat = await newUser();
    const banned = await newUser();
    const mode = { kind: "time", seconds: 30 } as const;
    await submit(good.token, subOf(playHuman({ ...timed(21), mode }, 21)));
    const sub = subOf(playHuman({ ...timed(22), mode: { kind: "time", seconds: 60 } }, 22));
    await submit(cheat.token, { ...sub, events: sub.events.map((e) => ({ ...e, t: Math.round(e.t / 10) })) });
    await submit(banned.token, subOf(playHuman({ ...timed(23), mode }, 23)));
    await admin.from("profiles").update({ banned: true }).eq("id", banned.id);

    const anon = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data, error } = await anon.rpc("leaderboard_mode", { p_mode: "30s", p_platform: "win", p_limit: 500 });
    expect(error).toBeNull();
    const names = data!.map((r: { display_name: string }) => r.display_name);
    expect(names).toContain(`player ${good.id.slice(0, 8)}`);
    expect(names).not.toContain(`player ${banned.id.slice(0, 8)}`);
    const { data: sixty } = await anon.rpc("leaderboard_mode", { p_mode: "60s", p_platform: "win", p_limit: 500 });
    expect(sixty!.map((r: { display_name: string }) => r.display_name)).not.toContain(`player ${cheat.id.slice(0, 8)}`);
    expect(Object.keys(data![0])).not.toContain("events");
  });

  it("the daily board lists today's ranked first attempts", async () => {
    const u = await newUser();
    const today = utcDate(Date.now());
    const res = await submit(u.token, subOf(playHuman(dailyConfig(today, "win", "us"), 31), true));
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const anon = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data } = await anon.rpc("leaderboard_daily", { p_daily: res.body!.summary.daily, p_platform: "win" });
    expect(data!.some((r: { display_name: string }) => r.display_name === `player ${u.id.slice(0, 8)}`)).toBe(true);
  });

  it("school and country boards need at least 3 players", async () => {
    const anon = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data, error } = await anon.rpc("leaderboard_groups", { p_group: "country", p_mode: "30s", p_platform: "win" });
    expect(error).toBeNull();
    for (const row of data!) expect(row.players).toBeGreaterThanOrEqual(3);
  });
});
