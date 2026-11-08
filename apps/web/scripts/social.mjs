#!/usr/bin/env node
// Renders docs/media/social-preview.png (1280×640) for GitHub → Settings → Social preview.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ImageResponse } from "@vercel/og";

const C = { bg: "#16181d", panel: "#1e2128", line: "#2c313b", sub: "#9198a4", text: "#e5e7eb", accent: "#4ade80", blue: "#5eb3ff" };
// Element builder for satori (no JSX). Undefined style values are dropped: satori rejects them.
const h = (type, style, ...children) => ({
  type,
  props: {
    style: Object.fromEntries(Object.entries({ display: "flex", ...style }).filter(([, v]) => v !== undefined)),
    children: children.length === 1 ? children[0] : children,
  },
});
const key = (t) => h("div", { padding: "10px 18px", marginRight: 12, borderRadius: 10, border: `3px solid ${C.line}`, borderBottomWidth: 7, background: C.panel, color: C.text, fontSize: 34 }, t);

// A tiny spreadsheet: a header row and a few numbers, one column selected.
const cell = (t, o = {}) => h("div", { width: 96, height: 40, alignItems: "center", justifyContent: "flex-end", paddingRight: 10, borderRight: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, fontSize: 20, color: C.text, ...o }, t);
const rows = [["", "FY24", "FY25", "FY26"], ["Rev", "1,380", "1,590", "1,830"], ["COGS", "(540)", "(610)", "(690)"], ["GP", "840", "980", "1,140"], ["Margin", "60.9%", "61.6%", "62.3%"]];
const grid = h(
  "div",
  { flexDirection: "column", border: `2px solid ${C.line}`, borderRadius: 8, background: C.panel },
  ...rows.map((r, i) =>
    h("div", {}, ...r.map((t, j) =>
      cell(t, {
        color: i === 0 ? C.sub : j === 0 ? C.sub : i === 1 || i === 2 ? C.blue : C.text,
        fontWeight: i === 3 ? 700 : 400,
        background: j === 3 && i > 0 ? "rgba(74,222,128,0.15)" : "transparent",
        borderTop: i === 3 ? `2px solid ${C.text}` : undefined,
        boxShadow: i === 1 && j === 3 ? `inset 0 0 0 3px ${C.accent}` : undefined,
      }),
    )),
  ),
);

const root = h(
  "div",
  { width: "100%", height: "100%", background: C.bg, padding: 72, justifyContent: "space-between", alignItems: "center" },
  h("div", { flexDirection: "column", maxWidth: 640 },
    h("div", { alignItems: "center", fontSize: 44, color: C.text, fontWeight: 700 }, h("div", { width: 34, height: 34, background: C.accent, marginRight: 18 }, ""), "cellrush"),
    h("div", { marginTop: 36, fontSize: 64, lineHeight: 1.1, color: C.text, fontWeight: 700 }, "How fast are you without a mouse?"),
    h("div", { marginTop: 24, fontSize: 30, color: C.sub }, "Monkeytype for spreadsheets. Excel shortcuts, against the clock."),
    h("div", { marginTop: 36 }, key("Ctrl"), key("Shift"), key("End"), key("F4")),
  ),
  grid,
);

const res = new ImageResponse(root, { width: 1280, height: 640 });
const out = fileURLToPath(new URL("../../../docs/media/social-preview.png", import.meta.url));
writeFileSync(out, new Uint8Array(await res.arrayBuffer()));
console.log(out);
