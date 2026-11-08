import { Link, useParams } from "react-router-dom";
import { decodeResult, squaresOf } from "@cellrush/drills";
import ShareBox from "../components/ShareBox";

/** Public result page: /r/:id (the id carries the result until server-validated runs exist, M5). */
export default function Result() {
  const { id = "" } = useParams();
  const s = decodeResult(id);
  if (!s) {
    return (
      <section className="py-20 text-center">
        <p className="text-sub">This result link is broken or incomplete.</p>
        <Link to="/" className="mt-4 inline-block text-accent hover:underline">play a round →</Link>
      </section>
    );
  }
  const title = s.daily !== null ? `Daily #${s.daily}` : `${s.mode} run`;
  return (
    <section className="space-y-8 py-6" data-testid="result-page">
      <div>
        <p className="text-xs text-sub">
          {title} · {s.date} · {s.platform === "mac" ? "macOS" : "Windows"} shortcuts
        </p>
        <p className="text-6xl font-bold text-accent tabular-nums">{s.score}</p>
        <p className="mt-1 text-2xl tracking-widest">{squaresOf(s)}</p>
      </div>
      <dl className="grid max-w-md grid-cols-3 gap-4 text-sm">
        <div><dt className="text-xs text-sub">tasks / min</dt><dd className="text-xl font-bold">{s.tpm.toFixed(1)}</dd></div>
        <div><dt className="text-xs text-sub">efficiency</dt><dd className="text-xl font-bold">{s.efficiency}%</dd></div>
        <div><dt className="text-xs text-sub">time</dt><dd className="text-xl font-bold">{(s.elapsedMs / 1000).toFixed(1)}s</dd></div>
      </dl>
      <ShareBox summary={s} />
      <p className="text-xs text-sub">Shared result, not verified. Leaderboard scores are replayed on the server.</p>
      <p>
        <Link to={s.daily !== null ? "/daily" : "/"} className="rounded border border-accent px-4 py-2 text-accent hover:bg-accent hover:text-bg">
          {s.daily !== null ? "play today's daily →" : "beat this score →"}
        </Link>
      </p>
    </section>
  );
}
