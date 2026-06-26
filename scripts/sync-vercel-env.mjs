#!/usr/bin/env node
/** Sync .env.local production vars to Vercel (zorino team). */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
];

function loadEnv(path) {
  const vars = {};
  if (!existsSync(path)) return vars;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key) vars[key] = val;
  }
  return vars;
}

const envPath = resolve(process.cwd(), ".env.local");
const vars = loadEnv(envPath);
vars.NEXT_PUBLIC_SITE_URL = vars.NEXT_PUBLIC_SITE_URL?.trim() || "https://zorino.org";

for (const key of KEYS) {
  const value = vars[key]?.trim();
  if (!value) {
    console.log(`skip ${key} (missing in .env.local)`);
    continue;
  }
  try {
    execSync(`npx vercel env rm ${key} production --scope zorino --yes`, { stdio: "pipe" });
  } catch {
    /* not set yet */
  }
  execSync(`npx vercel env add ${key} production --scope zorino --force`, {
    input: value,
    stdio: ["pipe", "inherit", "inherit"],
  });
  console.log(`set ${key}`);
}

console.log("Vercel production env sync complete.");
