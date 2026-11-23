#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    const commentIndex = value.search(/\s+#/);
    if (commentIndex >= 0) value = value.slice(0, commentIndex).trim();
    while (value.length > 1 && (value.startsWith('"') || value.startsWith("'")) && (value.endsWith('"') || value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const shouldProbe = !args.includes("--probe=0");
const valueOf = (name, fallback) => {
  const exact = args.find((arg) => arg.startsWith(`--${name}=`));
  if (exact) {
    const value = Number(exact.slice(name.length + 3));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  }
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1]) {
    const value = Number(args[index + 1]);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  }
  return fallback;
};
const concurrency = valueOf("concurrency", 64);
const timeoutMs = valueOf("timeout", 6000);
const probeLimit = valueOf("probe-limit", 0);
const provider = process.env.PURGE_IMAGE_PROVIDER || "admitad";
const PAGE_SIZE = 1000;
const DELETE_BATCH = 200;
const BAD_SHAPE_FILTER = "image_url.is.null,image_url.eq.,image_url.like./products/%,image_url.like.//%,image_url.like.http://%,image_url.like.data:%,image_url.ilike.%undefined%,image_url.ilike.%null%,image_url.ilike.%.svg%";

const out = (label, value) => process.stdout.write(`${label} ${JSON.stringify(value)}\n`);
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase service credentials");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

function isHttpsImageShape(value) {
  if (!value || typeof value !== "string") return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:" && !/\.svg($|\?)/i.test(parsed.pathname) && !/\.(localhost|127\.0\.0\.1)$/i.test(parsed.hostname);
  } catch {
    return false;
  }
}

async function badShapeRows() {
  const rows = [];
  let lastId = null;
  for (;;) {
    let query = db
      .from("lowest_prices_today")
      .select("id, product_id, image_url")
      .eq("provider", provider)
      .or(BAD_SHAPE_FILTER)
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);
    if (lastId) query = query.gt("id", lastId);
    const result = await query;
    if (result.error) throw new Error(result.error.message);
    if (!result.data?.length) break;
    rows.push(...result.data);
    lastId = result.data[result.data.length - 1].id;
  }
  return rows;
}

async function probeRows() {
  const rows = [];
  let lastId = null;
  for (;;) {
    let query = db
      .from("lowest_prices_today")
      .select("id, product_id, image_url")
      .eq("provider", provider)
      .not("image_url", "is", null)
      .neq("image_url", "")
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);
    if (lastId) query = query.gt("id", lastId);
    const result = await query;
    if (result.error) throw new Error(result.error.message);
    if (!result.data?.length) break;
    for (const row of result.data) {
      if (isHttpsImageShape(row.image_url)) rows.push(row);
    }
    lastId = result.data[result.data.length - 1].id;
    if (probeLimit > 0 && rows.length >= probeLimit) break;
  }
  return probeLimit > 0 ? rows.slice(0, probeLimit) : rows;
}

async function probeImage(imageUrl) {
  try {
    const response = await fetch(imageUrl, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status === 403 || response.status === 405) return true;
    if (!response.ok) return false;
    const contentType = response.headers.get("content-type");
    return !contentType || /^image\//i.test(contentType);
  } catch {
    return false;
  }
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

async function deleteRowsByIds(ids) {
  if (!ids.length) return 0;
  if (dryRun) return ids.length;
  for (let i = 0; i < ids.length; i += DELETE_BATCH) {
    const { error } = await db.from("lowest_prices_today").delete().in("id", ids.slice(i, i + DELETE_BATCH));
    if (error) throw new Error(error.message);
  }
  return ids.length;
}

async function cleanupOrphanProducts(productIds) {
  const uniqueIds = [...new Set(productIds.filter(Boolean))];
  let deleted = 0;
  let repaired = 0;
  for (let i = 0; i < uniqueIds.length; i += DELETE_BATCH) {
    const batch = uniqueIds.slice(i, i + DELETE_BATCH);
    const productsResult = await db
      .from("products")
      .select("id, main_image")
      .in("id", batch)
      .or("main_image.is.null,main_image.eq.,main_image.like./products/%,main_image.like.//%,main_image.like.http://%");
    if (productsResult.error) throw new Error(productsResult.error.message);
    const badProducts = productsResult.data ?? [];
    if (badProducts.length === 0) continue;

    const badIds = badProducts.map((row) => row.id);
    const [priceRefs, lowestRefs] = await Promise.all([
      db.from("prices").select("product_id").in("product_id", badIds).limit(5000),
      db.from("lowest_prices_today").select("product_id, image_url").in("product_id", badIds).limit(5000),
    ]);
    if (priceRefs.error) throw new Error(priceRefs.error.message);
    if (lowestRefs.error) throw new Error(lowestRefs.error.message);

    const referenced = new Set((priceRefs.data ?? []).map((row) => row.product_id));
    const repairImage = new Map();
    for (const row of lowestRefs.data ?? []) {
      referenced.add(row.product_id);
      if (isHttpsImageShape(row.image_url) && !repairImage.has(row.product_id)) {
        repairImage.set(row.product_id, row.image_url);
      }
    }

    const deletable = badIds.filter((id) => !referenced.has(id));
    if (deletable.length > 0 && !dryRun) {
      const { error } = await db.from("products").delete().in("id", deletable);
      if (error) throw new Error(error.message);
      deleted += deletable.length;
    } else if (deletable.length > 0) {
      deleted += deletable.length;
    }

    for (const [productId, imageUrl] of repairImage) {
      if (dryRun) {
        repaired += 1;
        continue;
      }
      const { error } = await db.from("products").update({ main_image: imageUrl }).eq("id", productId);
      if (error) throw new Error(error.message);
      repaired += 1;
    }
  }
  return { deleted, repaired };
}

const shapeRows = await badShapeRows();
out("bad-shape-rows", shapeRows.length);
const shapeDeleted = await deleteRowsByIds(shapeRows.map((row) => row.id));

const candidates = shouldProbe ? await probeRows() : [];
out("probe-candidates", { rows: candidates.length, enabled: shouldProbe, concurrency, timeoutMs });
const uniqueUrls = [...new Set(candidates.map((row) => row.image_url).filter(isHttpsImageShape))];
if (probeLimit > 0 && uniqueUrls.length > probeLimit) uniqueUrls.length = probeLimit;
const reachable = await mapLimit(uniqueUrls, concurrency, probeImage);
const reachableUrls = new Set(uniqueUrls.filter((_, index) => reachable[index]));
const unreachableRows = candidates.filter((row) => !reachableUrls.has(row.image_url));
out("unreachable-rows", unreachableRows.length);
const unreachableDeleted = await deleteRowsByIds(unreachableRows.map((row) => row.id));

const productCleanup = await cleanupOrphanProducts([
  ...shapeRows.map((row) => row.product_id),
  ...unreachableRows.map((row) => row.product_id),
]);
out("summary", {
  dryRun,
  provider,
  badShapeRows: shapeRows.length,
  badShapeDeleted: shapeDeleted,
  probedUrls: uniqueUrls.length,
  unreachableRows: unreachableRows.length,
  unreachableDeleted,
  ...productCleanup,
});
