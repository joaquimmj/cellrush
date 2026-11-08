import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeResult, type ShareSummary } from "@cellrush/drills";
import og from "./og";
import r, { resultMeta } from "./r";

const sample: ShareSummary = {
  daily: 42, mode: "daily", platform: "win", score: 412, efficiency: 87, tpm: 12.4, completed: 9,
  elapsedMs: 48_300, squares: "ggygxgggyg", date: "2026-12-19",
};
const id = encodeResult(sample);

describe("/api/og", () => {
  it("renders a 1200×630 PNG for a result", async () => {
    const res = og(new Request(`https://example.test/api/og?id=${id}`));
    expect(res.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(1, 4)].map((b) => String.fromCharCode(b)).join("")).toBe("PNG");
    // IHDR width/height (big-endian at offsets 16 and 20)
    const view = new DataView(bytes.buffer);
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([1200, 630]);
  }, 30_000);
  it("still renders a generic card for a bad id", async () => {
    const res = og(new Request("https://example.test/api/og?id=nope"));
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  }, 30_000);
});

describe("/r/:id preview tags", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("builds Open Graph + Twitter tags", () => {
    const meta = resultMeta(id, "https://cellrush.app");
    expect(meta).toContain('<meta property="og:title" content="cellrush daily #42: 412" />');
    expect(meta).toContain(`<meta property="og:image" content="https://cellrush.app/api/og?id=${id}" />`);
    expect(meta).toContain('name="twitter:card" content="summary_large_image"');
    expect(meta).toContain("🟩🟩🟨🟩⬛");
  });
  it("adds nothing for a malformed id", () => expect(resultMeta("x<script>", "https://cellrush.app")).toBe(""));
  it("injects the tags into the app shell", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html><head><title>cellrush</title></head><body></body></html>")));
    const res = await r(new Request(`https://cellrush.app/api/r?id=${id}`));
    const html = await res.text();
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(html).toMatch(/<title>cellrush<\/title>\s+<meta property="og:type"[\s\S]*<\/head>/);
  });
});
