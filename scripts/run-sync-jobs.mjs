#!/usr/bin/env node
/**
 * Trigger sync jobs via the cron API or report setup instructions.
 * Usage: npm run sync:run
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

const baseUrl = process.env.SYNC_CRON_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const secret = process.env.CRON_SECRET;

async function main() {
  const url = `${baseUrl.replace(/\/$/, "")}/api/cron/sync`;
  console.log(`Triggering sync: ${url}`);

  const headers = {};
  if (secret) headers["Authorization"] = `Bearer ${secret}`;

  try {
    const res = await fetch(url, { method: "POST", headers });
    const body = await res.json();

    if (!res.ok) {
      console.error("Sync failed:", body);
      process.exit(1);
    }

    console.log(`Success — ${body.jobsRun} job(s) run`);
    for (const r of body.results ?? []) {
      console.log(`  ${r.jobType}: ${r.status} (fetched ${r.itemsFetched}, updated ${r.itemsUpdated})`);
    }
  } catch (err) {
    console.error("Could not reach sync API. Start the dev server or set SYNC_CRON_URL.");
    console.error(err.message);
    process.exit(1);
  }
}

main();
