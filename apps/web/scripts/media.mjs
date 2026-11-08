#!/usr/bin/env node
// Records the README media from the running dev server (pnpm dev):
//   docs/media/demo.gif            ~13 s P&L speedrun, keys shown on screen
//   docs/media/theme-<id>.png      game page in three themes
// Usage: node apps/web/scripts/media.mjs [baseUrl]   (default http://localhost:5173)
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import gifenc from "gifenc";
import { PNG } from "pngjs";

const { GIFEncoder, quantize, applyPalette } = gifenc;
const BASE = process.argv[2] ?? "http://localhost:5173";
const OUT = fileURLToPath(new URL("../../../docs/media/", import.meta.url));
mkdirSync(OUT, { recursive: true });

const settings = (theme) => JSON.stringify({ theme, lang: "en", sound: false, animations: true });
const toPress = (k) => (k.code === "AltLeft" ? "Alt" : [k.ctrl && "Control", k.alt && "Alt", k.shift && "Shift", k.meta && "Meta", k.code].filter(Boolean).join("+"));
const ARROWS = { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" };
function label(k) {
  if (k.code === "AltLeft") return "Alt";
  const key = ARROWS[k.code] ?? (k.key.length === 1 ? k.key.toUpperCase() : k.key);
  return [k.ctrl && "Ctrl", k.alt && "Alt", k.shift && k.key.length !== 1 && "Shift", key].filter(Boolean).join(" + ");
}

const browser = await chromium.launch({ channel: process.env.CI ? undefined : "chrome", headless: true });

// ── theme screenshots ──
for (const theme of ["dark", "light", "terminal-green"]) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
  await page.addInitScript((s) => localStorage.setItem("cellrush.settings.v1", s), settings(theme));
  await page.goto(`${BASE}/?platform=win&mode=60s&seed=7`);
  await page.getByTestId("prompt").waitFor();
  // Before the first key: the clock shows the full minute (scripted keys would show a silly tasks/min).
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}theme-${theme}.png` });
  await page.close();
  console.log(`theme-${theme}.png`);
}

// ── demo GIF ──
const W = 960;
const H = 600;
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.addInitScript((s) => localStorage.setItem("cellrush.settings.v1", s), settings("dark"));
await page.goto(`${BASE}/speedrun?scenario=pnl-banking&platform=win&seed=5`);
await page.getByTestId("prompt").waitFor();
await page.evaluate(() => {
  const el = document.createElement("div");
  el.id = "keycast";
  Object.assign(el.style, {
    position: "fixed", right: "20px", bottom: "20px", padding: "10px 18px", borderRadius: "10px", zIndex: "99",
    font: "bold 26px ui-monospace, monospace", color: "#16181d", background: "#4ade80", boxShadow: "0 6px 24px rgba(0,0,0,.4)",
    opacity: "0",
  });
  document.body.appendChild(el);
});
const setCast = (text) => page.evaluate((t) => {
  const el = document.getElementById("keycast");
  el.textContent = t;
  el.style.opacity = t ? "1" : "0";
}, text);

const frames = [];
const grab = async (delay) => frames.push({ png: await page.screenshot(), delay });

await grab(1400); // read the prompt
const keys = await page.evaluate(() => window.__cellrush.optimalKeys());
for (const k of keys) {
  await page.keyboard.press(toPress(k));
  await setCast(label(k));
  await page.waitForTimeout(30);
  const slow = k.code === "Enter" || k.code === "AltLeft" || k.code === "KeyC";
  await grab(slow ? 320 : 150);
}
await setCast("");
await page.getByTestId("results").waitFor();
await page.waitForTimeout(200);
await grab(3000);
await browser.close();

const gif = GIFEncoder();
for (const f of frames) {
  const { data, width, height } = PNG.sync.read(f.png);
  const palette = quantize(data, 128);
  gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay: f.delay });
}
gif.finish();
writeFileSync(`${OUT}demo.gif`, gif.bytes());
if (process.env.MEDIA_PREVIEW) writeFileSync(process.env.MEDIA_PREVIEW, frames[Math.floor(frames.length * 0.6)].png);
const seconds = frames.reduce((s, f) => s + f.delay, 0) / 1000;
console.log(`demo.gif: ${frames.length} frames, ${seconds.toFixed(1)} s, ${(gif.bytes().length / 1e6).toFixed(2)} MB`);
