import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createRun, mulberry32, runKey, strokeToRaws, tick, toSubmission, type RunConfig, type RunState, type RunSubmission,
} from "@cellrush/drills";

/** Local stack keys, read from `supabase status` (needs `pnpm db:start`). */
function status(): Record<string, string> {
  const out = execSync("npx supabase status -o env", { cwd: fileURLToPath(new URL("../../..", import.meta.url)), encoding: "utf8" });
  return Object.fromEntries(
    out.split("\n").map((l) => /^([A-Z_]+)="?(.*?)"?$/.exec(l.trim())).filter(Boolean).map((m) => [m![1], m![2]]),
  );
}

const env = status();
export const API_URL = env.API_URL!;
export const ANON_KEY = env.ANON_KEY!;
export const SERVICE_KEY = env.SERVICE_ROLE_KEY!;
export const admin = createClient(API_URL, SERVICE_KEY, { auth: { persistSession: false } });

let n = 0;
const tokenIp = new Map<string, string>();
const created: string[] = [];

/** Delete every user this run created (profiles and runs cascade). */
export async function cleanup() {
  await Promise.all(created.splice(0).map((id) => admin.auth.admin.deleteUser(id)));
}
/** A fresh confirmed user signed in with a password (password sign-in is for tests only). */
export async function newUser(withProfile = true): Promise<{ client: SupabaseClient; id: string; token: string; ip: string }> {
  const email = `t${Date.now()}-${n++}-${Math.random().toString(36).slice(2, 8)}@test.cellrush.local`;
  const password = `pw-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const created_ = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created_.error) throw created_.error;
  created.push(created_.data.user.id);
  const client = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  const id = signed.data.user.id;
  if (withProfile) {
    const { error } = await client.from("profiles").insert({ id, display_name: `player ${id.slice(0, 8)}`, country: "FR", platform: "win" });
    if (error) throw error;
  }
  // Each test player gets its own client IP (locally the edge would otherwise lump all tests together).
  const ip = `10.${n}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  tokenIp.set(signed.data.session!.access_token, ip);
  return { client, id, token: signed.data.session!.access_token, ip };
}

export async function submit(token: string | null, body: unknown) {
  const res = await fetch(`${API_URL}/functions/v1/submit-run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: ANON_KEY,
      ...(token ? { authorization: `Bearer ${token}`, "cf-connecting-ip": tokenIp.get(token) ?? "10.255.0.1" } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as Record<string, any> | null };
}

/** A plausible human run: a reading pause per drill, then optimal keys 90–270 ms apart, from t = 0. */
export function playHuman(config: RunConfig, seed = 1, base = 180, readMs = 900): RunState {
  const rng = mulberry32(seed);
  let run = createRun(config);
  let t = 0;
  let first = true;
  for (let guard = 0; guard < 2000 && run.finishedAt === null; guard++) {
    const cur = run.current!;
    // Reading the prompt takes a moment (0.6–1.2 s by default) before the first key of a drill.
    if (!first && readMs > 0) t += readMs * 2 / 3 + rng.int(0, readMs * 2 / 3);
    for (const raw of cur.task.optimal(cur.params)[config.platform]!.flatMap((s) => strokeToRaws(s, config.layout))) {
      if (!first) t += base / 2 + rng.int(0, base);
      first = false;
      run = runKey(run, raw, t).run;
      if (run.finishedAt !== null) break;
    }
    if (config.mode.kind === "time" && t > config.mode.seconds * 1000) run = tick(run, t);
  }
  return run;
}

export const subOf = (run: RunState, daily = false): RunSubmission => toSubmission(run, daily);
