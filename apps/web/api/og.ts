import { ImageResponse } from "@vercel/og";
import { decodeResult, type ShareSummary } from "@cellrush/drills";

export const config = { runtime: "edge" };

const C = { bg: "#16181d", panel: "#1e2128", line: "#2c313b", sub: "#8b919c", text: "#e5e7eb", accent: "#4ade80", warn: "#fbbf24" };
const SQUARE: Record<string, string> = { g: C.accent, y: C.warn, x: C.line };

type El = { type: string; props: Record<string, unknown> };
/** Minimal element builder (satori accepts React-element-shaped objects; no JSX needed). */
const h = (type: string, style: Record<string, unknown>, ...children: (El | string)[]): El => ({
  type,
  props: { style: { display: "flex", ...style }, children: children.length === 1 ? children[0] : children },
});

function card(s: ShareSummary | null, app: string): El {
  if (!s) {
    return h("div", { width: "100%", height: "100%", background: C.bg, color: C.text, alignItems: "center", justifyContent: "center", fontSize: 64 },
      `${app} — How fast are you without a mouse?`);
  }
  const title = s.daily !== null ? `${app} daily #${s.daily}` : `${app} ${s.mode}`;
  const stat = (label: string, value: string) =>
    h("div", { flexDirection: "column", marginRight: 64 }, h("div", { fontSize: 28, color: C.sub }, label), h("div", { fontSize: 56, color: C.text }, value));
  return h(
    "div",
    { width: "100%", height: "100%", background: C.bg, color: C.text, flexDirection: "column", padding: 72, justifyContent: "space-between" },
    // Logo square drawn as a box: glyphs outside the bundled font would trigger a font download.
    h("div", { fontSize: 40, color: C.sub, alignItems: "center" }, h("div", { width: 28, height: 28, background: C.accent, marginRight: 18 }, ""), title),
    h("div", { flexDirection: "column" },
      h("div", { fontSize: 180, color: C.accent, lineHeight: 1 }, String(s.score)),
      h("div", { marginTop: 24 }, ...[...s.squares].map((q) => h("div", { width: 44, height: 44, marginRight: 10, borderRadius: 6, background: SQUARE[q] ?? C.line }, ""))),
    ),
    h("div", {},
      stat("tasks / min", s.tpm.toFixed(1)),
      stat("efficiency", `${s.efficiency}%`),
      stat("time", `${(s.elapsedMs / 1000).toFixed(1)}s`),
      stat("keys", s.platform === "mac" ? "macOS" : "Windows"),
    ),
  );
}

/** GET /api/og?id=<result id> → 1200×630 PNG for link previews. */
export default function handler(req: Request): Response {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const s = decodeResult(id);
  return new ImageResponse(card(s, "cellrush") as never, {
    width: 1200,
    height: 630,
    headers: { "cache-control": "public, max-age=31536000, immutable" },
  });
}
