#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);

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
const TARGET_PRODUCTS = 150;
const PER_QUERY = 30;

const CATEGORY_QUERIES = [
  { category: "phones", queries: ["iphone", "samsung galaxy", "xiaomi phone", "oppo phone", "mobile phone"] },
  { category: "electronics", queries: ["earbuds", "headphones", "bluetooth speaker", "power bank", "smart tv"] },
  { category: "watches", queries: ["smart watch", "men watch", "women watch"] },
  { category: "laptops", queries: ["laptop", "macbook", "gaming laptop"] },
  { category: "home", queries: ["air fryer", "vacuum cleaner", "microwave", "coffee machine"] },
];

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

function cleanTitle(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 180);
}

function resolveUrl(value, base = BASE_URL) {
  if (!value) return "";
  try {
    const url = new URL(String(value).trim().split(/\s+/)[0], base);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function isJumiaImage(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.toLowerCase().endsWith(".jumia.is");
  } catch {
    return false;
  }
}

async function scrapeQuery(page, query, category) {
  const url = `${BASE_URL}/catalog/?q=${encodeURIComponent(query)}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForSelector("article.prd", { timeout: 20_000 }).catch(() => {});
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);

  const rawCards = await page.$$eval("article.prd", (nodes) => {
    const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
    return nodes.map((node) => {
      const link = node.querySelector("a.core") || node.querySelector("a[href]");
      const image = node.querySelector("img");
      const values = (name) => link?.getAttribute(name) || node.getAttribute(name) || "";
      const srcset = image?.getAttribute("data-srcset") || image?.getAttribute("srcset") || "";
      return {
        externalId: values("data-gtm-id") || values("data-sku") || "",
        title:
          clean(node.querySelector("h3.name")?.textContent || "") ||
          clean(values("data-gtm-name")) ||
          clean(image?.getAttribute("alt") || ""),
        priceText: clean(node.querySelector(".prc")?.textContent || ""),
        oldPriceText: clean(node.querySelector(".old")?.textContent || ""),
        productHref: link?.getAttribute("href") || "",
        imageValue:
          image?.getAttribute("data-moengage-product_image") ||
          image?.getAttribute("data-src") ||
          image?.getAttribute("src") ||
          srcset.split(",")[0] ||
          "",
      };
    });
  });

  const results = [];
  const seen = new Set();
  for (const card of rawCards) {
    const productUrl = resolveUrl(card.productHref);
    const imageUrl = resolveUrl(card.imageValue);
    const price = parseMoney(card.priceText);
    const title = cleanTitle(card.title);
    if (!productUrl || !isJumiaImage(imageUrl) || !price || !title) continue;
    const externalId = card.externalId.trim() || productUrl;
    if (seen.has(externalId)) continue;
    seen.add(externalId);
    const originalPrice = parseMoney(card.oldPriceText);
    results.push({
      externalId,
      title,
      imageUrl,
      price,
      originalPrice: originalPrice > price ? originalPrice : price,
      discount: discountPercent(price, originalPrice),
      currency: "EGP",
      countryCode: "EG",
      storeName: STORE_NAME,
      category,
      productUrl,
      affiliateUrl: productUrl,
    });
    if (results.length >= PER_QUERY) break;
  }
  return results;
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
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const { chromium } = require("playwright");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
    userAgent: DESKTOP_UA,
    locale: "en-EG",
    timezoneId: "Africa/Cairo",
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();

  const all = new Map();
  try {
    for (const { category, queries } of CATEGORY_QUERIES) {
      for (const query of queries) {
        if (all.size >= TARGET_PRODUCTS) break;
        console.log(`[jumia-ingest] ${category}: ${query}`);
        try {
          const results = await scrapeQuery(page, query, category);
          for (const item of results) {
            const slug = `jumia-${slugify(item.externalId || item.productUrl)}`;
            if (!slug || all.has(slug)) continue;
            all.set(slug, {
              ...item,
              slug,
              categorySlug: slugify(item.category) || "general",
            });
          }
          console.log(`[jumia-ingest] ${query}: ${results.length} items (total ${all.size})`);
        } catch (error) {
          console.warn(`[jumia-ingest] query failed: ${query}`, error?.message || error);
        }
      }
      if (all.size >= TARGET_PRODUCTS) break;
    }
  } finally {
    await context.close();
    await browser.close();
  }

  const items = Array.from(all.values()).slice(0, TARGET_PRODUCTS);
  if (items.length === 0) {
    console.error("[jumia-ingest] no products fetched");
    process.exit(1);
  }

  if (process.argv.includes("--dry-run")) {
    const withImages = items.filter((item) => isJumiaImage(item.imageUrl)).length;
    console.log(`[jumia-ingest] dry run: ${items.length} products, ${withImages} Jumia CDN images`);
    console.log(`[jumia-ingest] sample: ${items[0]?.title} | ${items[0]?.imageUrl}`);
    return;
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const storeId = await ensureStore(supabase);
  const saved = await saveBatch(items, supabase, storeId);
  console.log(
    `[jumia-ingest] saved ${saved} real Jumia products (images: ${items.filter((item) => isJumiaImage(item.imageUrl)).length})`,
  );
  if (items.length < 100) {
    console.warn(`[jumia-ingest] only ${items.length} products fetched; target is ${TARGET_PRODUCTS}`);
  }
}

main().catch((err) => {
  console.error("[jumia-ingest] fatal:", err?.message || err);
  process.exit(1);
});
