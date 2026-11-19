#!/usr/bin/env node
/**
 * Standalone Jumia Egypt ingestion for scheduled GitHub Actions.
 * Fetches real listings from jumia.com.eg and upserts into Supabase catalog
 * (stores/products/prices/lowest_prices_today) so Render can serve Jumia
 * products even when live scraping is blocked in production.
 */

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
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const BASE_URL = "https://www.jumia.com.eg";
const STORE_NAME = "Jumia";
const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

const QUERIES = [
  "iphone",
  "samsung",
  "laptop",
  "headphones",
  "smart watch",
  "television",
  "air fryer",
  "refrigerator",
  "washing machine",
  "shoes",
  "perfume",
  "skincare",
  "gaming",
  "printer",
  "camera",
];

function headers(ua) {
  return {
    "user-agent": ua,
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "en-EG,en;q=0.9,ar-EG;q=0.8",
    referer: `${BASE_URL}/`,
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "same-origin",
    "upgrade-insecure-requests": "1",
  };
}

function decodeHtml(text = "") {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(text = "") {
  return decodeHtml(text.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function cleanTitle(value) {
  return decodeHtml(String(value ?? ""))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function getAttribute(tag, name) {
  const re = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const m = tag.match(re);
  return m ? decodeHtml(m[1] ?? m[2] ?? m[3] ?? "") : null;
}

function resolveUrl(value, base = BASE_URL) {
  if (!value) return "";
  try {
    return new URL(value, base).toString();
  } catch {
    return "";
  }
}

function parseMoney(value) {
  if (!value) return 0;
  const normalized = String(value)
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[^0-9.,]/g, "")
    .replace(/,/g, "");
  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function discountPercent(price, originalPrice) {
  if (!originalPrice || originalPrice <= price) return 0;
  return Math.max(0, Math.round(((originalPrice - price) / originalPrice) * 100));
}

function parseArticle(block) {
  const linkMatch = /<a\b[^>]*class="[^"]*\bcore\b[^"]*"[^>]*>/i.exec(block);
  const linkTag = linkMatch?.[0] ?? "";
  const href = getAttribute(linkTag, "href");
  const productUrl = resolveUrl(href, BASE_URL);
  if (!productUrl) return null;

  const externalId = (
    getAttribute(linkTag, "data-gtm-id") ||
    getAttribute(block, "data-sku") ||
    getAttribute(block, "data-gtm-id") ||
    ""
  ).trim();
  const title = cleanTitle(
    getAttribute(linkTag, "data-gtm-name") ||
      getAttribute(block, "data-gtm-name") ||
      stripTags(block.match(/<h3\b[^>]*class="[^"]*\bname\b[^"]*"[^>]*>[\s\S]*?<\/h3>/i)?.[0] ?? ""),
  );
  const priceText = block.match(/<div\b[^>]*class="[^"]*\bprc\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1];
  const price = parseMoney(stripTags(priceText ?? ""));
  if (!externalId || !title || !price) return null;

  const imageUrl = resolveUrl(getAttribute(block, "data-moengage-product_image"), BASE_URL);
  if (!imageUrl) return null;

  const oldPriceText = block.match(/<div\b[^>]*class="[^"]*\bold\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1];
  const oldPrice = parseMoney(stripTags(oldPriceText ?? ""));
  const originalPrice = oldPrice > price ? oldPrice : price;
  const category = (
    getAttribute(linkTag, "data-gtm-category") ||
    getAttribute(block, "data-gtm-category") ||
    ""
  ).split("/")[0]?.trim();

  return {
    externalId,
    title,
    imageUrl,
    price,
    originalPrice,
    discount: discountPercent(price, originalPrice),
    currency: "EGP",
    countryCode: "EG",
    storeName: STORE_NAME,
    category: category || "general",
    productUrl,
    affiliateUrl: productUrl,
  };
}

function parseJumiaHtml(html) {
  const results = [];
  const seen = new Set();
  const articlePattern = /<article\b[^>]*class="[^"]*\bprd\b[^"]*"[^>]*>[\s\S]*?<\/article>/gi;
  for (const match of html.matchAll(articlePattern)) {
    const item = parseArticle(match[0]);
    if (!item || seen.has(item.externalId)) continue;
    seen.add(item.externalId);
    results.push(item);
  }
  return results;
}

async function fetchText(url, ua, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: headers(ua), signal: controller.signal, redirect: "follow" });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function searchJumia(query, maxResults = 40) {
  const q = encodeURIComponent(query.trim());
  const urls = [`${BASE_URL}/catalog/?q=${q}`];
  const attempts = [
    fetchText(urls[0], DESKTOP_UA),
    fetchText(urls[0], MOBILE_UA),
  ];
  const htmls = await Promise.all(attempts);
  const merged = [];
  const seen = new Set();
  for (const html of htmls) {
    if (!html) continue;
    for (const item of parseJumiaHtml(html)) {
      if (seen.has(item.externalId)) continue;
      seen.add(item.externalId);
      merged.push(item);
      if (merged.length >= maxResults) return merged;
    }
  }
  return merged;
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function ensureStore(db) {
  const { data: existing } = await db.from("stores").select("id").eq("slug", "jumia").maybeSingle();
  if (existing?.id) return existing.id;
  const { data: created, error } = await db
    .from("stores")
    .insert({
      name: "Jumia",
      name_ar: "جوميا",
      slug: "jumia",
      website: "https://www.jumia.com.eg",
      integration_type: "partner",
      logo_initial: "JU",
      supported_regions: ["EG"],
      supported_currencies: ["EGP"],
      is_active: true,
    })
    .select("id")
    .single();
  if (error) throw new Error(`ensureStore failed: ${error.message}`);
  return created.id;
}

async function saveBatch(items, db, storeId) {
  let saved = 0;
  const BATCH = 150;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    const productRows = batch.map((item) => ({
      name: item.title,
      slug: item.slug,
      description: "",
      image_url: item.imageUrl,
      emoji: "🛍️",
      category_slug: item.categorySlug,
      brand: null,
      rating: null,
      review_count: 0,
      currency: item.currency,
      country_code: item.countryCode,
      in_stock: true,
      is_active: true,
    }));

    const { data: upserted, error: prodErr } = await db
      .from("products")
      .upsert(productRows, { onConflict: "slug", ignoreDuplicates: false })
      .select("id, slug");
    if (prodErr || !upserted?.length) continue;

    const slugToId = new Map(upserted.map((p) => [p.slug, p.id]));

    const priceRows = [];
    const lowestRows = [];
    const now = new Date().toISOString();
    for (const item of batch) {
      const productId = slugToId.get(item.slug);
      if (!productId) continue;
      priceRows.push({
        product_id: productId,
        store_id: storeId,
        price: item.price,
        original_price: item.originalPrice,
        currency: item.currency,
        country_code: item.countryCode,
        external_url: item.affiliateUrl || item.productUrl,
        external_product_id: item.externalId,
        in_stock: true,
        is_current: true,
      });
      lowestRows.push({
        product_id: productId,
        country_code: item.countryCode,
        currency: item.currency,
        product_name: item.title,
        product_slug: item.slug,
        image_url: item.imageUrl,
        emoji: "🛍️",
        lowest_price: item.price,
        original_price: item.originalPrice,
        discount_percent: item.discount,
        savings_amount: Math.max(0, item.originalPrice - item.price),
        store_id: storeId,
        store_name: item.storeName,
        provider: "jumia",
        affiliate_url: item.affiliateUrl || item.productUrl,
        external_url: item.productUrl,
        is_new_low: false,
        price_recorded_at: now,
        computed_at: now,
      });
    }

    if (priceRows.length) {
      await db.from("prices").upsert(priceRows, {
        onConflict: "product_id,store_id,country_code,currency",
        ignoreDuplicates: false,
      });
    }
    if (lowestRows.length) {
      await db.from("lowest_prices_today").upsert(lowestRows, {
        onConflict: "product_id,country_code,currency",
        ignoreDuplicates: false,
      });
    }
    saved += batch.length;
  }
  return saved;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const all = new Map();
  for (const query of QUERIES) {
    console.log(`[jumia-ingest] searching: ${query}`);
    try {
      const results = await searchJumia(query, 40);
      for (const item of results) {
        const slug = `jumia-${slugify(item.externalId || item.productUrl)}`;
        if (!slug || all.has(slug)) continue;
        all.set(slug, {
          ...item,
          slug,
          categorySlug: slugify(item.category || "general") || "general",
        });
      }
      console.log(`[jumia-ingest] ${query}: ${results.length} items (total ${all.size})`);
    } catch (err) {
      console.warn(`[jumia-ingest] query failed: ${query}`, err?.message || err);
    }
  }

  const items = Array.from(all.values());
  if (items.length === 0) {
    console.log("[jumia-ingest] no products fetched");
    return;
  }

  const storeId = await ensureStore(supabase);
  const saved = await saveBatch(items, supabase, storeId);
  console.log(`[jumia-ingest] saved ${saved} products`);
}

main().catch((err) => {
  console.error("[jumia-ingest] fatal:", err?.message || err);
  process.exit(1);
});
