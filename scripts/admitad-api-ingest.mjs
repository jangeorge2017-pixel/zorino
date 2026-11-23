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
function extractRawTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1].trim() : null;
}

function extractTag(xml, tag) {
  return extractRawTag(xml, `g:${tag}`) ?? extractRawTag(xml, tag);
}

function decodeXml(text) {
  return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function unwrapCdata(value) {
  const text = String(value || "").trim();
  const cdata = text.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return cdata ? cdata[1].trim() : text;
}

function normalizeScrapedImageUrl(value) {
  let url = decodeXml(unwrapCdata(value)).replace(/\\+\//g, "/").replace(/\s+/g, "");
  if (url.startsWith("//")) url = `https:${url}`;
  if (/^http:\/\//i.test(url)) url = `https://${url.slice(7)}`;
  if (!/^https:\/\//i.test(url)) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || /\.svg($|\?)/i.test(parsed.pathname)) return "";
    return parsed.toString();
  } catch { return ""; }
}

function toGlobalSku(slug) {
  return `admitad:${String(slug ?? "").replace(/^admitad-/, "")}`;
}

function extractOfferImage(xml) {
  const variants = [
    extractRawTag(xml, "g:image_link"),
    extractRawTag(xml, "image_link"),
    extractRawTag(xml, "image"),
    extractRawTag(extractRawTag(xml, "image") || "", "url"),
  ];
  for (const raw of variants) {
    if (!raw) continue;
    const url = normalizeScrapedImageUrl(raw);
    if (url) return url;
  }
  return "";
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
    image = extractOfferImage(xml);
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
    image = extractOfferImage(xml);
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
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function ensureStore(db) {
  const { data: existing } = await db.from("stores").select("id").eq("slug", "admitad").maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created } = await db.from("stores").insert({
    name: "Admitad (Alibaba)", name_ar: "أدميتاد (علي بابا)", slug: "admitad",
    website: "https://admitad.com", integration_type: "partner",
    logo_url: "/stores/alibaba.svg", logo_initial: "Ad",
    supported_regions: ["US"], supported_currencies: ["USD"], is_active: true,
  }).select("id").single();
  return created?.id;
}

function initials(name) {
  const letters = String(name || "").replace(/[^a-zA-Z0-9]/g, "");
  return (letters.slice(0, 2) || "AR").toUpperCase();
}

async function syncAdmitadMerchantStoreRows(db, campaigns) {
  const rows = [];
  const seen = new Set();
  for (const campaign of campaigns || []) {
    const id = campaign?.id;
    const name = String(campaign?.name || "").trim();
    const website = String(campaign?.site_url || "").trim();
    if (!id || !name || !/^https?:\/\//i.test(website)) continue;
    const slug = `admitad-${id}`;
    if (seen.has(slug)) continue;
    seen.add(slug);
    const regions = Array.isArray(campaign?.regions) && campaign.regions.length
      ? campaign.regions.map((r) => r?.region).filter(Boolean)
      : ["US"];
    const currency = campaign?.currency ? [campaign.currency] : ["USD"];
    rows.push({
      name,
      slug,
      website,
      integration_type: "partner",
      logo_initial: initials(name),
      supported_regions: regions,
      supported_currencies: currency,
      external_store_id: String(id),
      admitted_network: "admitad",
      admitted_campaign_id: String(id),
      is_active: true,
    });
  }
  if (!rows.length) return 0;
  const { error } = await db.from("stores").upsert(rows, { onConflict: "slug", ignoreDuplicates: false });
  if (error) {
    console.warn("[admitad-ingest] merchant store sync failed:", error.message);
    return 0;
  }
  console.log(`[admitad-ingest] synced ${rows.length} admitad merchant store rows`);
  return rows.length;
}
// ---------------------------------------------------------------------------
// Batch DB save (reusable for incremental persistence)
// ---------------------------------------------------------------------------
async function saveBatch(products, db, storeId) {
  if (!products.length) return 0;
  let saved = 0;
  let rejectedImages = 0;
  const BATCH = 200;
  const validProducts = products.filter((p) => {
    const imageUrl = normalizeScrapedImageUrl(p.imageUrl);
    if (!imageUrl) {
      rejectedImages += 1;
      return false;
    }
    p.imageUrl = imageUrl;
    return true;
  });
  for (let i = 0; i < validProducts.length; i += BATCH) {
    const now = new Date().toISOString();
    const batch = validProducts.slice(i, i + BATCH);
    if (!batch.length) continue;

    const productRows = batch.map(p => ({
      global_sku: toGlobalSku(p.slug),
      title: p.title,
      description: null,
      brand: null,
      main_image: p.imageUrl,
      category_path: p.categorySlug,
      barcode: null,
      updated_at: now,
    }));

    const { data: upserted, error: upsertError } = await db.from("products").upsert(productRows, {
      onConflict: "global_sku", ignoreDuplicates: false,
    }).select("id, global_sku");

    if (upsertError) {
      console.error("[admitad-ingest] product upsert failed:", upsertError.message);
      continue;
    }
    if (!upserted?.length) continue;

    const skuToId = new Map(upserted.map(p => [p.global_sku, p.id]));

    const priceRows = batch.flatMap(p => {
      const pid = skuToId.get(toGlobalSku(p.slug));
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
      const { error: priceError } = await db.from("prices").upsert(priceRows, {
        onConflict: "product_id,store_id,country_code,currency", ignoreDuplicates: false,
      });
      if (priceError) console.error("[admitad-ingest] price upsert failed:", priceError.message);
    }

    const lowestRows = batch.flatMap(p => {
      const pid = skuToId.get(toGlobalSku(p.slug));
      const o = p.offers?.[0];
      if (!pid || !o) return [];
      return [{
        product_id: pid, country_code: p.countryCode, currency: p.currency,
        product_name: p.title, product_slug: p.slug, image_url: p.imageUrl,
        emoji: p.emoji, lowest_price: o.price, original_price: o.originalPrice,
        discount_percent: p.discount, savings_amount: Math.max(0, o.originalPrice - o.price),
        store_id: storeId, store_name: o.storeName, provider: "admitad",
        affiliate_url: o.affiliateUrl, external_url: o.productUrl,
        is_new_low: false, price_recorded_at: now, computed_at: now,
      }];
    });

    if (lowestRows.length) {
      const { error: lowestError } = await db.from("lowest_prices_today").upsert(lowestRows, {
        onConflict: "product_id,country_code,currency", ignoreDuplicates: false,
      });
      if (lowestError) {
        console.error("[admitad-ingest] lowest_prices_today upsert failed:", lowestError.message);
        continue;
      }
      saved += lowestRows.length;
    }
  }
  if (rejectedImages > 0) {
    console.warn(`[admitad-ingest] rejected ${rejectedImages} offer(s) without a valid https image`);
  }
  return saved;
}

async function backfillAdmitadImages(db, imageBySlug) {
  if (!db || imageBySlug.size === 0) return 0;
  const byImage = new Map();
  for (const [slug, imageUrl] of imageBySlug) {
    if (!slug || !imageUrl) continue;
    const slugs = byImage.get(imageUrl) || [];
    slugs.push(slug);
    byImage.set(imageUrl, slugs);
  }

  let updated = 0;
  for (const [imageUrl, slugs] of byImage) {
    const safeImageUrl = normalizeScrapedImageUrl(imageUrl);
    if (!safeImageUrl) continue;
    for (let i = 0; i < slugs.length; i += 200) {
      const batch = slugs.slice(i, i + 200);
      const updates = await Promise.all([
        db.from("products").update({ main_image: safeImageUrl }).in("global_sku", batch.map(toGlobalSku)),
        db.from("lowest_prices_today").update({ image_url: safeImageUrl }).in("product_slug", batch),
      ]);
      for (const result of updates) {
        if (result.error) console.warn("[admitad-ingest] image backfill failed:", result.error.message);
      }
      updated += batch.length;
    }
  }
  return updated;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const testMode = args.includes("--test");
const resumeFrom = (() => { const m = args.find(a => a.startsWith("--resume-from=")); return m ? parseInt(m.split("=")[1]) || 0 : 0; })();
const saveEvery = (() => { const m = args.find(a => a.startsWith("--save-every=")); return m ? parseInt(m.split("=")[1]) || 10 : 10; })();
const positiveEnvInt = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
};
const maxFeeds = positiveEnvInt("ADMITAD_MAX_FEEDS", Infinity);
const maxPerFeed = positiveEnvInt("ADMITAD_MAX_PRODUCTS_PER_FEED", 5000);

async function main() {
  console.log("=== Admitad API Ingestion ===");
  console.log(`Mode: ${testMode ? "TEST" : dryRun ? "DRY RUN" : "FULL"}`);
  if (resumeFrom > 0) console.log(`Resume from feed: ${resumeFrom}`);
  console.log(`Save every: ${saveEvery} feeds`);
  console.log(`Max feeds: ${Number.isFinite(maxFeeds) ? maxFeeds : "all"}`);
  console.log(`Max products per feed: ${maxPerFeed}`);
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

  // 3. Discover active campaigns and product feeds
  console.log("\n3. Discovering active programs and product feeds...");
  const allCampaignsById = new Map();
  const allFeedEntries = [];
  for (const website of websites) {
    let campaigns = [];
    try {
      campaigns = await listAllPages(`/advcampaigns/website/${website.id}/`);
    } catch (err) {
      console.warn(`   Website ${website.id}: failed to list campaigns (${err?.message || err})`);
      campaigns = [];
    }
    const activeCampaigns = campaigns.filter(
      (c) => c?.connection_status === "active" && (c?.status === "active" || !c?.status)
    );
    console.log(`   Website ${website.id}: ${campaigns.length} campaigns (${activeCampaigns.length} active)`);
    for (const c of activeCampaigns) {
      allCampaignsById.set(c.id, c);
      if (!Array.isArray(c.feeds_info) || c.feeds_info.length === 0) continue;
      for (const feed of c.feeds_info) {
        allFeedEntries.push({ campaign: c, feed, websiteId: website.id });
      }
    }
  }
  const allActiveCampaigns = Array.from(allCampaignsById.values());
  console.log(`   Active campaigns discovered: ${allActiveCampaigns.length}`);
  console.log(`   Total feeds discovered: ${allFeedEntries.length}`);

  try {
    const dbForStores = getSupabase();
    if (dbForStores) {
      await syncAdmitadMerchantStoreRows(dbForStores, allActiveCampaigns);
    }
  } catch (err) {
    console.warn("   Merchant store pre-sync failed:", err?.message || err);
  }

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
  const perFeedLimit = dryRun ? Math.min(200, maxPerFeed) : maxPerFeed;
  const feedLimit = Number.isFinite(maxFeeds)
    ? Math.min(allFeedEntries.length, resumeFrom + maxFeeds)
    : allFeedEntries.length;
  console.log(`\n4. Fetching products from ${feedLimit - resumeFrom} of ${allFeedEntries.length} feeds...`);
  if (resumeFrom > 0) console.log(`   Skipping first ${resumeFrom} feeds (--resume-from)`);

  const seenIds = new Set();
  const imageBySlug = new Map();
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

  for (let i = 0; i < feedLimit; i++) {
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
        for (const o of offers.slice(0, perFeedLimit)) {
          const imageUrl = normalizeScrapedImageUrl(o.image);
          if (!imageUrl || !o.url || !/^https?:\/\//i.test(o.url)) continue;
          if (seenIds.has(o.id)) continue;
          seenIds.add(o.id);
          const slug = `admitad-${campaign.id}-${o.id}`;
          imageBySlug.set(slug, imageUrl);
          const storeSlug = campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
          const discount = o.oldprice && o.oldprice > o.price
            ? Math.round(((o.oldprice - o.price) / o.oldprice) * 100) : 0;
          allProducts.push({
            id: slug,
            slug,
            title: o.name, imageUrl, emoji: "🛍️",
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

  if (db) {
    const imageBackfill = await backfillAdmitadImages(db, imageBySlug);
    console.log(`   [images] Backfilled ${imageBackfill} product rows`);
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

  try {
    const dbFinal = getSupabase();
    if (dbFinal) {
      await syncAdmitadMerchantStoreRows(dbFinal, allActiveCampaigns);
    }
  } catch (err) {
    console.warn("Merchant store final sync failed:", err?.message || err);
  }

  console.log(`\n=== Results ===`);
  console.log(`Authenticated:       true`);
  console.log(`Websites found:      ${websites.length}`);
  console.log(`Active campaigns:    ${allActiveCampaigns.length}`);
  console.log(`Programs with feeds: ${programReport.size}`);
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
