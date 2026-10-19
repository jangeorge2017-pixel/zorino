#!/usr/bin/env node
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

const baseUrl = (
  process.env.SYNC_CRON_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  `http://localhost:${process.env.PORT ?? 3000}`
).replace(/\/$/, "");

const secret = process.env.CRON_SECRET;
const intervalMs = Math.max(60_000, Number(process.env.WORKER_INTERVAL_MS ?? 3_600_000));
const requestTimeoutMs = Math.max(
  30_000,
  Number(process.env.WORKER_REQUEST_TIMEOUT_MS ?? 900_000),
);
const retryAttempts = Math.max(1, Number(process.env.WORKER_RETRY_ATTEMPTS ?? 3));
const retryDelayMs = Math.max(1_000, Number(process.env.WORKER_RETRY_DELAY_MS ?? 30_000));
const runOnStart = (process.env.WORKER_RUN_ON_START ?? "true") !== "false";
const jobs = (process.env.WORKER_JOBS ?? "/api/cron/refresh,/api/cron/sync")
  .split(",")
  .map((job) => job.trim())
  .filter(Boolean);

let stopping = false;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function attemptJob(path) {
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = { "content-type": "application/json" };
  if (secret) headers.authorization = `Bearer ${secret}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  const startedAt = Date.now();

  try {
    const res = await fetch(url, { method: "POST", headers, signal: controller.signal });
    const text = await res.text();
    const durationMs = Date.now() - startedAt;
    console.log(`[worker] ${path} -> ${res.status} (${durationMs}ms)`);
    if (!res.ok) {
      console.error(`[worker] ${path} body: ${text.slice(0, 500)}`);
      return res.status < 500;
    }
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[worker] ${path} failed: ${message}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function runJob(path) {
  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    if (await attemptJob(path)) return;
    if (attempt < retryAttempts && !stopping) await sleep(retryDelayMs);
  }
}

async function runCycle() {
  for (const job of jobs) {
    if (stopping) return;
    await runJob(job);
  }
}

async function main() {
  console.log(`[worker] target=${baseUrl} jobs=${jobs.join(",")} intervalMs=${intervalMs}`);
  if (runOnStart) await runCycle();

  while (!stopping) {
    await sleep(intervalMs);
    if (stopping) break;
    await runCycle();
  }

  console.log("[worker] stopped");
}

process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[worker] fatal: ${message}`);
  process.exit(1);
});
