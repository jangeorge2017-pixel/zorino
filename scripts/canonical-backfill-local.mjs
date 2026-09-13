// Phase 3 identity-bootstrap backfill — SAFE LOCAL TARGET ONLY.
//
// Run:   npx tsx scripts/canonical-backfill-local.mjs                (DRY RUN)
//        npx tsx scripts/canonical-backfill-local.mjs --apply-file ./identity-out.jsonl
//        npx tsx scripts/canonical-backfill-local.mjs --json
//
// SAFETY:
//  - Default is DRY RUN: bootstrap + cluster in memory, write nothing.
//  - `--apply-file <path>` writes only to a LOCAL JSON-lines file (the safe
//    non-production target). It NEVER touches Supabase and NEVER opens any
//    network connection.
//  - This script never applies migration 025 and never calls db:push.
//  - It consumes the real canonical lib via tsx (single source of truth):
//    localStorage? No — lib/canonical/identity only.

import fs from "node:fs";
import path from "node:path";
import {
  backfillLowestPricesRows,
  bootstrapIdentityFromRow,
  InMemoryCanonicalIdentityStore,
  LocalJsonIdentityStore,
} from "@/lib/canonical/identity";

const ARGS = process.argv.slice(2);
const applyFile = ARGS.includes("--apply-file")
  ? ARGS[ARGS.indexOf("--apply-file") + 1]
  : null;
const asJson = ARGS.includes("--json");

if (applyFile && applyFile.startsWith("http")) {
  console.error("Refusing non-local target. --apply-file must be a local file path.");
  process.exit(2);
}

const fixturePath = path.join(process.cwd(), "scripts", "fixtures", "lowest-prices-backfill-fixture.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const rows = fixture.rows;

console.log(`Phase 3 identity bootstrap — ${asJson ? "json" : "dry-run"}`);
console.log(`Source fixture: ${path.relative(process.cwd(), fixturePath)} (${rows.length} rows)`);
console.log(`Target: ${applyFile ? `LOCAL FILE ${applyFile}` : "dry-run (no writes)"}`);

const store = applyFile ? new LocalJsonIdentityStore(applyFile) : new InMemoryCanonicalIdentityStore();
const stats = await backfillLowestPricesRows(rows, { store, skipExisting: true });

if (!asJson) {
  console.log("\n=== per-row identity ===\n");
  for (const row of rows) {
    const out = bootstrapIdentityFromRow(row);
    if ("error" in out) {
      console.log(`  [skip:${out.error.reason}] ${row.product_name || row.product_id || "(no name)"}`);
      continue;
    }
    const i = out.identity;
    console.log(
      `  ${row.provider}/${row.store_name || "?"} ${row.product_name.slice(0, 42).padEnd(42)} ` +
      `${String(row.lowest_price).padStart(7)} → key=${i.key} product=${i.canonicalProductId} offer=${i.canonicalOfferId}`
    );
  }
  console.log("\n=== backfill result ===");
  console.log(JSON.stringify(stats, null, 2));
  console.log("\nStore writes: " + (await store.count()));
} else {
  console.log(JSON.stringify(stats, null, 2));
}