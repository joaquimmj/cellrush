import { decodeResult, squaresOf } from "@cellrush/drills";

export const config = { runtime: "edge" };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Meta tags for a result: what X, LinkedIn, WhatsApp and Slack show in the link preview. */
export function resultMeta(id: string, origin: string, app = "cellrush"): string {
  const s = decodeResult(id);
  if (!s) return "";
  const title = s.daily !== null ? `${app} daily #${s.daily}: ${s.score}` : `${app} ${s.mode}: ${s.score}`;
  const desc = `${squaresOf(s)} · ${s.tpm.toFixed(1)} tasks/min · ${s.efficiency}% efficiency. How fast are you without a mouse?`;
  const image = `${origin}/api/og?id=${encodeURIComponent(id)}`;
  const url = `${origin}/r/${id}`;
  return [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
  ].join("\n    ");
}

/**
 * /r/:id (rewritten here by vercel.json): serve the normal app shell with the result's
 * preview tags injected, so crawlers see the card and people get the React result page.
 */
export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? url.pathname.split("/").pop() ?? "";
  const shell = await fetch(new URL("/index.html", url.origin)).then((r) => r.text());
  const html = shell.replace("</head>", `    ${resultMeta(id, url.origin)}\n  </head>`);
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
