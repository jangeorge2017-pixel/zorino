#!/usr/bin/env node
/**
 * Read-only Supabase setup verification: tables, seed data, admin migration artifacts.
 * Usage: node scripts/verify-supabase-setup.mjs
 */
import { createClient } from "@supabase/supabase-js";
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !serviceKey || !anonKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

const coreTables = [
  "countries",
  "currencies",
  "profiles",
  "categories",
  "stores",
  "products",
  "prices",
  "deals",
  "coupons",
  "favorites",
  "notifications",
];

const syncTables = ["product_images", "product_sources", "sync_jobs", "sync_runs"];

const seedMinimums = {
  countries: 5,
  currencies: 5,
  categories: 7,
  stores: 7,
  products: 4,
  prices: 4,
  deals: 4,
  coupons: 4,
};

const report = {
  url,
  tables: {},
  seedData: {},
  adminMigration: {},
  adminDashboard: {},
  ok: true,
};

async function countTable(client, table) {
  const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
  return { count: count ?? 0, error: error?.message ?? null };
}

console.log("Zorino Supabase setup verification (read-only)");
console.log("URL:", url);
console.log("---");

for (const table of [...coreTables, ...syncTables]) {
  const result = await countTable(admin, table);
  report.tables[table] = result;
  const status = result.error ? `ERROR — ${result.error}` : `${result.count} rows`;
  console.log(`${table}: ${status}`);
  if (result.error) report.ok = false;
}

console.log("--- seed data ---");
for (const [table, minimum] of Object.entries(seedMinimums)) {
  const count = report.tables[table]?.count ?? 0;
  const pass = count >= minimum;
  report.seedData[table] = { count, minimum, pass };
  console.log(`${table}: ${pass ? "OK" : "LOW"} (${count}/${minimum}+)`);
  if (!pass) report.ok = false;
}

console.log("--- admin migration (003) ---");
const { data: buckets, error: bucketError } = await admin.storage.listBuckets();
const catalogBucket = buckets?.find((b) => b.id === "catalog-images");
report.adminMigration.catalogImagesBucket = {
  exists: !!catalogBucket,
  public: catalogBucket?.public ?? false,
  error: bucketError?.message ?? null,
};
console.log(
  `catalog-images bucket: ${catalogBucket ? "exists" : "missing"}${
    catalogBucket ? ` (public: ${catalogBucket.public})` : ""
  }`
);
if (!catalogBucket) report.ok = false;

// Public read sanity check via anon client
const { data: publicStores, error: publicReadError } = await anon
  .from("stores")
  .select("id")
  .limit(1);
report.adminDashboard.publicCatalogRead = {
  ok: !publicReadError && (publicStores?.length ?? 0) > 0,
  error: publicReadError?.message ?? null,
};
console.log(
  `anon catalog read: ${report.adminDashboard.publicCatalogRead.ok ? "OK" : "FAILED"}${
    publicReadError ? ` — ${publicReadError.message}` : ""
  }`
);
if (!report.adminDashboard.publicCatalogRead.ok) report.ok = false;

// Admin env configured for Next.js app
report.adminDashboard.envConfigured = {
  url: Boolean(url),
  anonKey: Boolean(anonKey),
  serviceRoleKey: Boolean(serviceKey),
};
console.log(`app env (.env.local): ${Object.values(report.adminDashboard.envConfigured).every(Boolean) ? "OK" : "INCOMPLETE"}`);

console.log("---");
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
