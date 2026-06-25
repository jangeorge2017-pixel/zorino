#!/usr/bin/env node
/**
 * Trigger trending rankings refresh via cron API.
 * Usage: node scripts/run-trending-refresh.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const port = process.env.PORT ?? "3000";
const secret = process.env.CRON_SECRET;
const base = process.env.NEXT_PUBLIC_SITE_URL ?? `http://localhost:${port}`;
const url = new URL("/api/cron/trending", base);
url.searchParams.set("force", "true");
if (secret) url.searchParams.set("secret", secret);

console.log("Triggering trending refresh:", url.origin + url.pathname);

const res = await fetch(url.toString(), { method: "POST" });
const text = await res.text();
let body;
try {
  body = text ? JSON.parse(text) : null;
} catch {
  console.error("Non-JSON response:", text.slice(0, 500));
  process.exit(1);
}
console.log(JSON.stringify(body, null, 2));
process.exit(res.ok ? 0 : 1);
