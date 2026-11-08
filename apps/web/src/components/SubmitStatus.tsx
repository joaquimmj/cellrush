import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toSubmission, type RunState } from "@cellrush/drills";
import { supabase, useAccount } from "../lib/supabase";

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "ranked"; score: number }
  | { kind: "unranked"; score: number; flags: string[] }
  | { kind: "error"; message: string };

const FLAG_TEXT: Record<string, string> = {
  "inhuman-speed": "keys faster than a human",
  "robotic-timing": "key timing too regular",
  "impossible-tpm": "more drills per minute than humanly possible",
};

/**
 * Sends a finished run's keystrokes to the server, which replays them and decides the score.
 * Guests see an invitation to sign in instead.
 */
export default function SubmitStatus({ run, daily }: { run: RunState; daily: boolean }) {
  const { session, profile, ready } = useAccount();
  const [state, setState] = useState<State>({ kind: "idle" });
  const sent = useRef<RunState | null>(null);

  useEffect(() => {
    if (!supabase || !session || !profile || run.finishedAt === null || sent.current === run) return;
    if (run.results.every((r) => r.status !== "done")) return;
    sent.current = run;
    setState({ kind: "sending" });
    supabase.functions
      .invoke("submit-run", { body: toSubmission(run, daily) })
      .then(async ({ data, error }) => {
        if (error) {
          // FunctionsHttpError carries the server's JSON in error.context.
          const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
          setState({ kind: "error", message: body?.error ?? error.message });
          return;
        }
        if (data.ranked) setState({ kind: "ranked", score: data.summary.score });
        else setState({ kind: "unranked", score: data.summary.score, flags: data.flags });
      });
  }, [run, daily, session, profile]);

  if (!supabase || !ready) return null;
  if (!session) {
    return (
      <p className="text-sm text-sub" data-testid="submit-status">
        <Link to="/login" className="text-accent hover:underline">Sign in</Link> to put your runs on the leaderboard.
      </p>
    );
  }
  if (!profile) {
    return (
      <p className="text-sm text-sub" data-testid="submit-status">
        <Link to="/profile" className="text-accent hover:underline">Pick a display name</Link> to put your runs on the leaderboard.
      </p>
    );
  }
  const text =
    state.kind === "sending" ? "checking your run on the server…"
    : state.kind === "ranked" ? `✓ verified by the server: ${state.score}, on the leaderboard`
    : state.kind === "unranked" ? `saved but not ranked (${state.flags.map((f) => FLAG_TEXT[f] ?? f).join(", ")}). A human will review it.`
    : state.kind === "error" ? `not submitted: ${state.message}`
    : "";
  return (
    <p data-testid="submit-status" className={`text-sm ${state.kind === "ranked" ? "text-accent" : state.kind === "error" || state.kind === "unranked" ? "text-warn" : "text-sub"}`}>
      {text} {state.kind === "ranked" && <Link to="/leaderboard" className="underline">see leaderboard</Link>}
    </p>
  );
}
