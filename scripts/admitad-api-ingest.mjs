#!/usr/bin/env node
/**
 * Standalone Admitad API product ingestion script.
 *
 * Usage:
 *   node scripts/admitad-api-ingest.mjs              # full run
 *   node scripts/admitad-api-ingest.mjs --dry-run     # test without DB writes
 *   node scripts/admitad-api-ingest.mjs --test         # authenticate + discover only
 *
 * Requires ADMITAD_CLIENT_ID and ADMITAD_CLIENT_SECRET in .env.local.
 * Self-contained — no TypeScript imports needed.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Load .env.local (use process.cwd() for reliable path resolution)
// ---------------------------------------------------------------------------
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const API_BASE = "https://api.admitad.com";
const TOKEN_URL = `${API_BASE}/token/`;

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------
let cachedToken = null;

async function obtainAccessToken() {
  const clientId = process.env.ADMITAD_CLIENT_ID;
  const clientSecret = process.env.ADMITAD_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Missing ADMITAD_CLIENT_ID/SECRET");

  const scope = "advcampaigns advcampaigns_for_website websites deeplink_generator";
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope,
  });

  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) throw new Error(`Token HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  console.log(`   Token obtained: ${data.access_token.slice(0, 10)}..., scope: ${data.scope}`);
  return data.access_token;
}

async function getToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.accessToken;
  return obtainAccessToken();
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------
let requestTimestamps = [];
const RATE_LIMIT = 90;
const RATE_WINDOW = 60_000;

async function throttle() {
  const now = Date.now();
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - RATE_WINDOW) requestTimestamps.shift();
  if (requestTimestamps.length >= RATE_LIMIT) {
    const wait = requestTimestamps[0] + RATE_WINDOW - now + 100;
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
  }
  requestTimestamps.push(Date.now());
}

async function apiGet(path, params) {
  for (let attempt = 0; attempt <= 3; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, Math.min(2000 * 2 ** (attempt - 1), 10_000)));
    }
    await throttle();
    const token = await getToken();
    const url = new URL(path, API_BASE);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    });

    if (resp.status === 401) { cachedToken = null; continue; }
    if (resp.status === 429) {
      const retry = parseInt(resp.headers.get("Retry-After") ?? "5", 10);
      await new Promise(r => setTimeout(r, retry * 1000));
      continue;
    }
    if (!resp.ok) throw new Error(`API ${resp.status} on ${path}: ${await resp.text()}`);
    return resp.json();
  }
  throw new Error(`API failed after retries: ${path}`);
}

async function listAllPages(path, params) {
  const all = [];
  let offset = 0;
  const limit = 100;
  for (;;) {
    const data = await apiGet(path, { ...params, offset: String(offset), limit: String(limit) });
    all.push(...data.results);
    if (all.length >= data._meta.count || data.results.length === 0) break;
    offset += limit;
  }
  return all;
}

// ---------------------------------------------------------------------------
// Feed XML parser
// ---------------------------------------------------------------------------
function extractTag(xml, tag) {
  // Try g: namespace first (Google Merchant format), then plain tag
  const gTag = `g:${tag}`;
  let m = xml.match(new RegExp(`<${gTag}>([^<]*)</${gTag}>`));
  if (m) return m[1].trim();
  m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? m[1].trim() : null;
}

function decodeXml(text) {
  return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

/** Strip markup by re-joining the text content between tags (text nodes). */
function toPlainText(value) {
  return (value || "").split(/<[^>]+>/).join("").trim();
}

function parsePrice(raw) {
  if (!raw) return null;
  // "5.82 USD" → 5.82
  const num = parseFloat(raw.replace(/[^\d.]/g, ""));
  return isNaN(num) || num <= 0 ? null : num;
}

function parseOffer(xml) {
  // Support both formats: Admitad <offer id="..."> (with or without extra attributes)
  // and Google Merchant <entry> with <g:id>, <g:price>, etc.
  let id, name, priceStr, oldpriceStr, currencyId, url, image, vendor, description;

  const idM = xml.match(/<offer\s+id="(\d+)"/);
  if (idM) {
    // Admitad legacy format
    id = idM[1];
    name = extractTag(xml, "name");
    priceStr = extractTag(xml, "price");
    oldpriceStr = extractTag(xml, "oldprice");
    currencyId = extractTag(xml, "currencyId") || "USD";
    url = decodeXml(extractTag(xml, "url") || "");
    image = decodeXml(extractTag(xml, "image") || "");
    vendor = extractTag(xml, "vendor") || "";
    description = toPlainText(extractTag(xml, "description"));
  } else {
    // Google Merchant / Atom format: <entry> with <g:id>, <g:price>, etc.
    id = extractTag(xml, "id");
    name = extractTag(xml, "title");
    priceStr = extractTag(xml, "price");
    currencyId = "USD";
    const priceMatch = priceStr?.match(/([A-Z]{3})$/);
    if (priceMatch) currencyId = priceMatch[1];
    url = decodeXml(extractTag(xml, "link") || "");
    image = decodeXml(extractTag(xml, "image_link") || "");
    description = toPlainText(extractTag(xml, "description"));
    vendor = "";
    oldpriceStr = null;
  }

  if (!id || !name || !priceStr) return null;
  const price = parsePrice(priceStr);
  if (!price) return null;
  const oldprice = oldpriceStr && oldpriceStr !== "None" ? parsePrice(oldpriceStr) : null;

  return {
    id, name: decodeXml(name), price,
    oldprice: oldprice && !isNaN(oldprice) ? oldprice : null,
    currencyId,
    description: description || "",
    vendor: vendor || "",
    url: url || "",
    image: image || "",
    modified_time: extractTag(xml, "modified_time") || "",
  };
}

async function fetchFeed(feedUrl) {
  const resp = await fetch(feedUrl, {
    headers: { "User-Agent": "ZorinoBot/2.0-admitad-api" },
    signal: AbortSignal.timeout(120_000),
  });
  if (!resp.ok) throw new Error(`Feed HTTP ${resp.status}`);
  if (!resp.body) throw new Error("Feed body null");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  const offers = new Map();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // Match <offer id="N"...>...</offer> (with optional extra attrs like available="true")
    // and <entry>...</entry> (Google Merchant)
    const re = /<(?:offer\s+id="\d+"[^>]*|entry)>[\s\S]*?<\/(?:offer|entry)>/g;
    let m;
    while ((m = re.exec(buffer)) !== null) {
      const o = parseOffer(m[0]);
      if (o && !offers.has(o.id)) offers.set(o.id, o);
    }
    const last = Math.max(buffer.lastIndexOf("<offer"), buffer.lastIndexOf("<entry"));
    buffer = last > 0 ? buffer.slice(last) : "";
  }
  // Process any remaining buffer containing a partial/complete offer
  if (buffer.includes("<offer") || buffer.includes("<entry>")) {
    const re2 = /<(?:offer\s+id="\d+"[^>]*|entry)>[\s\S]*?<\/(?:offer|entry)>/g;
    let m2;
    while ((m2 = re2.exec(buffer)) !== null) {
      const o = parseOffer(m2[0]);
      if (o && !offers.has(o.id)) offers.set(o.id, o);
    }
  }
  return Array.from(offers.values());
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function ensureStore(db) {
  const { data: existing } = await db.from("stores").select("id").eq("slug", "admitad").single();
  if (existing) return existing.id;
  const { data: created } = await db.from("stores").insert({
    name: "Admitad (Alibaba)", name_ar: "أدميتاد (علي بابا)", slug: "admitad",
    website: "https://admitad.com", integration_type: "partner",
    logo_url: "/stores/alibaba.svg", logo_initial: "Ad",
    supported_regions: ["US"], supported_currencies: ["USD"], is_active: true,
  }).select("id").single();
  return created?.id;
}

// ---------------------------------------------------------------------------
// Batch DB save (reusable for incremental persistence)
// ---------------------------------------------------------------------------
async function saveBatch(products, db, storeId) {
  if (!products.length) return 0;
  let saved = 0;
  const BATCH = 200;
  for (let i = 0; i < products.length; i += BATCH) {
    const batch = products.slice(i, i + BATCH);

    const productRows = batch.map(p => ({
      name: p.title, slug: p.slug, description: "", image_url: p.imageUrl,
      emoji: p.emoji, category_slug: p.categorySlug, brand: null,
      rating: null, review_count: 0, currency: p.currency,
      country_code: p.countryCode, in_stock: true, is_active: true,
    }));

    const { data: upserted } = await db.from("products").upsert(productRows, {
      onConflict: "slug", ignoreDuplicates: false,
    }).select("id, slug");

    if (!upserted?.length) continue;

    const slugToId = new Map(upserted.map(p => [p.slug, p.id]));

    const priceRows = batch.flatMap(p => {
      const pid = slugToId.get(p.slug);
      const o = p.offers?.[0];
      if (!pid || !o) return [];
      return [{
        product_id: pid, store_id: storeId, price: o.price,
        original_price: o.originalPrice, currency: o.currency,
        country_code: o.countryCode, external_url: o.affiliateUrl || o.productUrl,
        external_product_id: o.externalId, in_stock: o.inStock, is_current: true,
      }];
    });

    if (priceRows.length) {
      await db.from("prices").upsert(priceRows, {
        onConflict: "product_id,store_id,country_code,currency", ignoreDuplicates: false,
      });
    }

    const lowestRows = batch.flatMap(p => {
      const pid = slugToId.get(p.slug);
      const o = p.offers?.[0];
      if (!pid || !o) return [];
      return [{
        product_id: pid, country_code: p.countryCode, currency: p.currency,
        product_name: p.title, product_slug: p.slug, image_url: p.imageUrl,
        emoji: p.emoji, lowest_price: o.price, original_price: o.originalPrice,
        discount_percent: p.discount, savings_amount: Math.max(0, o.originalPrice - o.price),
        store_id: storeId, store_name: o.storeName, provider: "admitad",
        affiliate_url: o.affiliateUrl, external_url: o.productUrl,
        is_new_low: false, price_recorded_at: new Date().toISOString(),
        computed_at: new Date().toISOString(),
      }];
    });

    if (lowestRows.length) {
      await db.from("lowest_prices_today").upsert(lowestRows, {
        onConflict: "product_id,country_code,currency", ignoreDuplicates: false,
      });
    }

    saved += batch.length;
  }
  return saved;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const testMode = args.includes("--test");
const resumeFrom = (() => { const m = args.find(a => a.startsWith("--resume-from=")); return m ? parseInt(m.split("=")[1]) || 0 : 0; })();
const saveEvery = (() => { const m = args.find(a => a.startsWith("--save-every=")); return m ? parseInt(m.split("=")[1]) || 10 : 10; })();

async function main() {
  console.log("=== Admitad API Ingestion ===");
  console.log(`Mode: ${testMode ? "TEST" : dryRun ? "DRY RUN" : "FULL"}`);
  if (resumeFrom > 0) console.log(`Resume from feed: ${resumeFrom}`);
  console.log(`Save every: ${saveEvery} feeds`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  if (!process.env.ADMITAD_CLIENT_ID || !process.env.ADMITAD_CLIENT_SECRET) {
    console.error("ERROR: ADMITAD_CLIENT_ID and ADMITAD_CLIENT_SECRET must be set in .env.local");
    process.exit(1);
  }

  // 1. Authenticate
  console.log("1. Authenticating...");
  const token = await obtainAccessToken();
  console.log(`   Token: ${token.slice(0, 10)}...`);

  // 2. Discover websites
  console.log("\n2. Discovering websites...");
  const websites = await listAllPages("/websites/");
  console.log(`   Found ${websites.length} websites:`);
  for (const w of websites) {
    console.log(`   - ID: ${w.id}, Name: ${w.name}, URL: ${w.url}, Status: ${w.status}`);
  }

  // 3. Discover programs with feeds
  console.log("\n3. Discovering programs with product feeds...");
  const allFeedEntries = [];
  for (const website of websites) {
    const campaigns = await listAllPages(`/advcampaigns/website/${website.id}/`, { has_tool: "products" });
    console.log(`   Website ${website.id}: ${campaigns.length} programs with feeds`);
    for (const c of campaigns) {
      if (!c.feeds_info?.length) continue;
      for (const feed of c.feeds_info) {
        allFeedEntries.push({ campaign: c, feed, websiteId: website.id });
      }
    }
  }
  console.log(`   Total feeds discovered: ${allFeedEntries.length}`);

  if (testMode) {
    console.log("\n=== Test Complete ===");
    return;
  }

  // 4. Fetch products — sort Alibaba first, then try ALL feeds
  allFeedEntries.sort((a, b) => {
    const aIsAlibaba = a.campaign.name?.toLowerCase().includes("alibaba") ? 0 : 1;
    const bIsAlibaba = b.campaign.name?.toLowerCase().includes("alibaba") ? 0 : 1;
    return aIsAlibaba - bIsAlibaba;
  });
  const maxPerFeed = dryRun ? 200 : 5000;
  console.log(`\n4. Fetching products from ALL ${allFeedEntries.length} feeds (no cap)...`);
  if (resumeFrom > 0) console.log(`   Skipping first ${resumeFrom} feeds (--resume-from)`);

  const seenIds = new Set();
  const allProducts = [];
  let feedsOk = 0;
  let feedsFailed = 0;
  let totalSaved = 0;

  // Per-program tracking for the final report
  const programReport = new Map(); // campaignId → { name, feeds: [{name, status, products, error}] }

  // Resolve DB + store up front for incremental saves
  let db = null;
  let storeId = null;
  if (!dryRun) {
    db = getSupabase();
    if (db) {
      storeId = await ensureStore(db);
      if (!storeId) { console.error("   Failed to create/resolve admitad store — DB saves disabled"); db = null; }
    }
  }

  for (let i = 0; i < allFeedEntries.length; i++) {
    // Skip feeds before resume point
    if (i < resumeFrom) continue;

    const { campaign, feed } = allFeedEntries[i];
    const feedUrl = feed.xml_link?.replace("http://", "https://");
    if (!feedUrl) {
      feedsFailed++;
      const pr = programReport.get(campaign.id) || { name: campaign.name, feeds: [] };
      pr.feeds.push({ name: feed.name || "unknown", status: "skipped", products: 0, error: "no feed URL" });
      programReport.set(campaign.id, pr);
      continue;
    }

    process.stdout.write(`   [${i + 1}/${allFeedEntries.length}] "${feed.name}" (${campaign.name})... `);

    let success = false;
    let lastError = "";
    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const backoff = 3000 * attempt;
        process.stdout.write(`retry${attempt}(${backoff / 1000}s)... `);
        await new Promise(r => setTimeout(r, backoff));
      }
      try {
        const offers = await fetchFeed(feedUrl);
        let count = 0;
        for (const o of offers.slice(0, maxPerFeed)) {
          if (seenIds.has(o.id)) continue;
          seenIds.add(o.id);
          const storeSlug = campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
          const discount = o.oldprice && o.oldprice > o.price
            ? Math.round(((o.oldprice - o.price) / o.oldprice) * 100) : 0;
          allProducts.push({
            id: `admitad-${campaign.id}-${o.id}`,
            slug: `admitad-${campaign.id}-${o.id}`,
            title: o.name, imageUrl: o.image || "", emoji: "🛍️",
            categorySlug: "general", rating: 0, reviewCount: 0,
            countryCode: "US", currency: o.currencyId,
            price: o.price, originalPrice: o.oldprice ?? o.price,
            discount, discountType: "percentage",
            providerIds: ["admitad"],
            offers: [{
              providerId: "admitad", storeSlug, storeName: campaign.name,
              externalId: o.id, price: o.price, originalPrice: o.oldprice ?? o.price,
              currency: o.currencyId, countryCode: "US",
              affiliateUrl: o.url, productUrl: o.url, inStock: true,
            }],
            fetchedAt: new Date().toISOString(),
          });
          count++;
        }
        feedsOk++;
        const pr = programReport.get(campaign.id) || { name: campaign.name, feeds: [] };
        pr.feeds.push({ name: feed.name || "unknown", status: "ok", products: count, error: null });
        programReport.set(campaign.id, pr);
        console.log(`${count} products`);
        success = true;
        break;
      } catch (err) {
        lastError = err.message;
        // Don't retry permanent HTTP errors (4xx except 429/401)
        const httpMatch = lastError.match(/Feed HTTP (\d+)/);
        const code = httpMatch ? parseInt(httpMatch[1]) : 0;
        if (code >= 400 && code < 500 && code !== 429) break;
      }
    }
    if (!success) {
      feedsFailed++;
      const pr = programReport.get(campaign.id) || { name: campaign.name, feeds: [] };
      pr.feeds.push({ name: feed.name || "unknown", status: "failed", products: 0, error: lastError });
      programReport.set(campaign.id, pr);
      console.log(`FAILED: ${lastError}`);
    }

    // Incremental save every N feeds
    if (db && storeId && allProducts.length > 0 && (i + 1) % saveEvery === 0) {
      const batchSaved = await saveBatch(allProducts, db, storeId);
      totalSaved += batchSaved;
      allProducts.length = 0; // flush the buffer
      console.log(`   [checkpoint] Saved ${batchSaved} products (total: ${totalSaved})`);
    }
  }

  // Flush any remaining products
  if (db && storeId && allProducts.length > 0) {
    const batchSaved = await saveBatch(allProducts, db, storeId);
    totalSaved += batchSaved;
    allProducts.length = 0;
    console.log(`   [final] Saved ${batchSaved} products (total: ${totalSaved})`);
  }

  console.log(`\n   Total unique products fetched: ${seenIds.size}`);

  // 5. Summary
  if (dryRun) {
    console.log("\n=== DRY RUN — no DB saves ===");
    return;
  }

  console.log(`\n\n=== Per-Program Report ===`);
  console.log(`${"Program".padEnd(45)} ${"Feeds".padStart(6)} ${"OK".padStart(4)} ${"Fail".padStart(5)} ${"Products".padStart(9)}  Reason`);
  console.log("-".repeat(100));

  const programIds = [...programReport.keys()].sort((a, b) => {
    const pa = programReport.get(a), pb = programReport.get(b);
    const ta = pa.feeds.reduce((s, f) => s + f.products, 0);
    const tb = pb.feeds.reduce((s, f) => s + f.products, 0);
    return tb - ta;
  });

  let totalFeeds = 0, totalOk = 0, totalFail = 0, totalProducts = 0;
  for (const pid of programIds) {
    const pr = programReport.get(pid);
    const ok = pr.feeds.filter(f => f.status === "ok").length;
    const fail = pr.feeds.filter(f => f.status === "failed").length;
    const products = pr.feeds.reduce((s, f) => s + f.products, 0);
    totalFeeds += pr.feeds.length;
    totalOk += ok;
    totalFail += fail;
    totalProducts += products;

    // Aggregate failure reasons
    const reasons = [...new Set(pr.feeds.filter(f => f.error).map(f => f.error))];
    const reason = reasons.length ? reasons.join("; ").slice(0, 60) : "";
    console.log(`${pr.name.slice(0, 44).padEnd(45)} ${String(pr.feeds.length).padStart(6)} ${String(ok).padStart(4)} ${String(fail).padStart(5)} ${String(products).padStart(9)}  ${reason}`);
  }

  console.log("-".repeat(100));
  console.log(`${"TOTAL".padEnd(45)} ${String(totalFeeds).padStart(6)} ${String(totalOk).padStart(4)} ${String(totalFail).padStart(5)} ${String(totalProducts).padStart(9)}`);

  console.log(`\n=== Results ===`);
  console.log(`Authenticated:       true`);
  console.log(`Websites found:      ${websites.length}`);
  console.log(`Programs discovered: ${programReport.size}`);
  console.log(`Feeds attempted:     ${feedsOk + feedsFailed}`);
  console.log(`Feeds OK:            ${feedsOk}`);
  console.log(`Feeds failed:        ${feedsFailed}`);
  console.log(`Products fetched:    ${seenIds.size}`);
  console.log(`Products saved:      ${totalSaved}`);
  console.log("\n=== Done ===");
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
