#!/usr/bin/env node
// Minimal, dependency-free secret scanner. Runs on staged files (pre-commit) or all tracked files (--all).
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const all = process.argv.includes("--all");
const list = execSync(all ? "git ls-files" : "git diff --cached --name-only --diff-filter=ACM", { encoding: "utf8" })
  .split("\n").filter(Boolean);

const RULES = [
  [/sb_secret_[A-Za-z0-9_-]{20,}/, "Supabase secret key"],
  [/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, "JWT (Supabase service_role / anon?)"],
  [/(?:SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE)\s*[=:]\s*['"]?[A-Za-z0-9._-]{20,}/, "Supabase service role"],
  [/gh[pousr]_[A-Za-z0-9]{36,}/, "GitHub token"],
  [/AKIA[0-9A-Z]{16}/, "AWS access key"],
  [/sk-(?:ant-)?[A-Za-z0-9_-]{32,}/, "API secret key"],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "Private key"],
  [/vercel_[A-Za-z0-9]{24,}/i, "Vercel token"],
];
const SKIP = /(^|\/)(pnpm-lock\.yaml|.*\.(png|jpg|gif|ico|woff2?))$/;

let bad = 0;
for (const f of list) {
  if (SKIP.test(f) || !existsSync(f)) continue;
  if (/(^|\/)\.env(\.|$)/.test(f) && !f.endsWith(".env.example")) {
    console.error(`✗ ${f}: .env files must never be committed`);
    bad++;
    continue;
  }
  const text = readFileSync(f, "utf8");
  text.split("\n").forEach((line, i) => {
    for (const [re, name] of RULES) if (re.test(line)) { console.error(`✗ ${f}:${i + 1}: possible ${name}`); bad++; }
  });
}
if (bad) { console.error(`\n${bad} possible secret(s). Commit blocked.`); process.exit(1); }
