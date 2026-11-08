// submit-run: the only way a run reaches the leaderboards.
// The client sends its keystrokes; this function replays them with the same engine the browser
// used (bundled from packages/drills by `pnpm build:edge`), recomputes the score, applies the
// anti-cheat checks and stores the server's result. Anything the client claims about its score
// is ignored.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
// @ts-ignore generated ESM bundle (see scripts/build-edge.mjs)
import { validateRun } from "../_shared/cellrush.gen.js";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

const MAX_BODY = 400_000;
const PER_USER_PER_MINUTE = 6;
const PER_IP_PER_MINUTE = 30;

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  const auth = req.headers.get("Authorization");
  if (!auth) return json(401, { error: "sign in to submit runs" });
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const asUser = createClient(url, anonKey, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: userData } = await asUser.auth.getUser();
  const user = userData?.user;
  if (!user) return json(401, { error: "sign in to submit runs" });

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: profile } = await db.from("profiles").select("banned").eq("id", user.id).maybeSingle();
  if (!profile) return json(403, { error: "create your profile first" });
  if (profile.banned) return json(403, { error: "this account cannot submit runs" });

  // Rate limits: per account and per (hashed) IP.
  const since = new Date(Date.now() - 60_000).toISOString();
  // Client IP as set by the edge in front of us (Cloudflare on hosted Supabase, Kong locally).
  // Never the first x-forwarded-for entry: the client writes that one itself.
  const ip = (req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "").trim();
  const ipHash = ip ? await sha256(`${ip}:${serviceKey.slice(-12)}`) : null;
  const [{ count: userCount }, { count: ipCount }] = await Promise.all([
    db.from("runs").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since),
    ipHash
      ? db.from("submit_log").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since)
      : Promise.resolve({ count: 0 }),
  ]);
  if ((userCount ?? 0) >= PER_USER_PER_MINUTE || (ipCount ?? 0) >= PER_IP_PER_MINUTE) {
    return json(429, { error: "too many runs, try again in a minute" });
  }
  if (ipHash) await db.from("submit_log").insert({ ip_hash: ipHash, user_id: user.id });

  const text = await req.text();
  if (text.length > MAX_BODY) return json(413, { error: "run too large" });
  let sub: unknown;
  try {
    sub = JSON.parse(text);
  } catch {
    return json(400, { error: "invalid JSON" });
  }

  const v = validateRun(sub, Date.now());
  if (!v.ok) return json(422, { error: v.reason });

  const s = v.summary!;
  const sc = v.score!;
  // deno-lint-ignore no-explicit-any
  const body = sub as any;
  const { data: row, error } = await db
    .from("runs")
    .insert({
      user_id: user.id,
      mode: s.mode,
      platform: body.platform,
      layout: body.layout,
      seed: body.seed,
      played_on: body.today,
      daily_number: v.dailyNumber ?? null,
      score: sc.score,
      tpm: sc.tpm,
      efficiency: sc.efficiency,
      completed: sc.completed,
      elapsed_ms: Math.round(sc.elapsedMs),
      squares: s.squares,
      flags: v.flags,
      ranked: v.ranked,
      events: body.events,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return json(409, { error: "you already submitted today's daily" });
    console.error("insert failed", error.message);
    return json(500, { error: "could not save the run" });
  }
  if (v.flags.length) await db.from("flags").insert(v.flags.map((reason: string) => ({ run_id: row.id, reason })));

  return json(200, { id: row.id, ranked: v.ranked, flags: v.flags, summary: s });
});
