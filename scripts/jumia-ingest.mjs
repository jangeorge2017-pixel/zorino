#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
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
const SITEMAP_INDEX = "https://static.jumia.com.eg/index-sitemap.xml";
const STORE_NAME = "Jumia";
const BOT_UA = "Mozilla/5.0 (compatible; ZorinoBot/1.0; +https://zorino-1.onrender.com)";
const TARGET_PRODUCTS = 150;
const IPHONE_TARGET = 15;
const PER_QUERY = 20;
const SITEMAP_LIMIT = 30;
const FETCH_CONCURRENCY = 12;
const USE_PLAYWRIGHT = process.argv.includes("--playwright");

const CATEGORY_QUERIES = [
  { category: "phones", queries: ["iphone", "samsung galaxy", "xiaomi phone", "oppo phone", "mobile phone"] },
  { category: "electronics", queries: ["earbuds", "headphones", "bluetooth speaker", "power bank", "smart tv"] },
  { category: "watches", queries: ["smart watch", "men watch", "women watch"] },
  { category: "laptops", queries: ["laptop", "macbook", "gaming laptop"] },
  { category: "home", queries: ["air fryer", "vacuum cleaner", "microwave", "coffee machine"] },
];

const URL_TOKENS = {
  iphone: "iphone",
  "samsung galaxy": "samsung",
  "xiaomi phone": "xiaomi",
  "oppo phone": "oppo",
  "mobile phone": "mobile",
  "bluetooth speaker": "speaker",
  "smart tv": "tv",
  "smart watch": "smart-watch",
  "men watch": "men",
  "women watch": "women",
  "gaming laptop": "gaming",
  "air fryer": "air-fryer",
  "vacuum cleaner": "vacuum",
  "coffee machine": "coffee",
};

const PHONE_QUERIES = new Set([
  "iphone",
  "samsung galaxy",
  "xiaomi phone",
  "oppo phone",
  "mobile phone",
]);

const PHONE_ACCESSORY_RE =
  /case|cover|protector|tempered|glass|holder|mount|cable|charger|charging|bumper|shield|pouch|skin|sticker|strap|lanyard|adapter|pen|microphone|tripod|gimbal|stand|lens|for iphone|for samsung|for xiaomi|for oppo|screen guard|selfie stick|sim tray/i;
const PHONE_ACCESSORY_URL_RE =
  /case|cover|protector|tempered|glass|holder|mount|cable|charger|charging|bumper|shield|pouch|skin|sticker|strap|lanyard|adapter|pen|microphone|tripod|gimbal|stand|lens|for-iphone|for-samsung|for-xiaomi|for-oppo|screen-guard|selfie-stick|sim-tray/i;

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

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function fetchText(url, timeoutMs = 30_000) {
  const response = await fetch(url, {
    headers: { "User-Agent": BOT_UA, "Accept-Language": "en-US,en;q=0.9" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

async function fetchSitemapIndex() {
  const xml = await fetchText(SITEMAP_INDEX);
  return Array.from(
    xml.matchAll(
      /<sitemap>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>\s*<\/sitemap>/gi,
    ),
  )
    .map((match) => ({ url: match[1], lastmod: match[2] }))
    .filter((row) => /\/products-sitemap-\d+\.xml\.gz$/i.test(row.url))
    .sort((a, b) => b.lastmod.localeCompare(a.lastmod));
}

async function fetchSitemap(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": BOT_UA, "Accept": "application/gzip,application/xml;q=0.9,*/*;q=0.8" },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return gunzipSync(Buffer.from(await response.arrayBuffer())).toString("utf8");
}

function parseSitemap(xml) {
  const rows = [];
  for (const block of xml.match(/<url>[\s\S]*?<\/url>/gi) ?? []) {
    const url = block.match(/<loc>([^<]+)<\/loc>/i)?.[1] ?? "";
    if (!url.includes("www.jumia.com.eg") || !url.endsWith(".html")) continue;
    const image = block.match(/<image:loc>([^<]+)<\/image:loc>/i)?.[1] ?? "";
    rows.push({ url, image });
  }
  return rows;
}

function urlToken(query) {
  return URL_TOKENS[query] ?? query.split(" ")[0];
}

function titleMatchesQuery(query, title) {
  const value = title.toLowerCase();
  if (query === "iphone") {
    return (
      (/apple\s+iphone|iphone\s+\d/i.test(title) || /iphone\s+\d/i.test(title)) &&
      !PHONE_ACCESSORY_RE.test(value)
    );
  }
  if (query === "samsung galaxy") {
    return value.includes("samsung") && value.includes("galaxy") && !PHONE_ACCESSORY_RE.test(value);
  }
  if (PHONE_QUERIES.has(query)) {
    return value.includes(query.split(" ")[0]) && !PHONE_ACCESSORY_RE.test(value);
  }
  return value.includes(query.toLowerCase());
}

function parseJsonLdProduct(html) {
  for (const match of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed = JSON.parse(match[1]);
      const nodes = Array.isArray(parsed) ? parsed : parsed?.["@graph"] ?? [parsed];
      const product = nodes.find((node) => node?.["@type"] === "Product");
      if (product) return product;
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchProduct(url, sitemapImage, query, category) {
  const html = await fetchText(url, 12_000);
  const product = parseJsonLdProduct(html);
  if (!product) return null;

  const title = cleanTitle(product.name);
  if (!title || !titleMatchesQuery(query, title)) return null;

  const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
  const price = parseMoney(offer?.price ?? offer?.lowPrice);
  if (!price) return null;

  const imageCandidates = Array.isArray(product.image?.contentUrl)
    ? product.image.contentUrl
    : Array.isArray(product.image)
      ? product.image
      : [product.image?.contentUrl ?? product.image?.url ?? product.image ?? sitemapImage];
  const imageUrl = imageCandidates.map((value) => resolveUrl(value)).find(isJumiaImage) ?? "";
  const productUrl = resolveUrl(product.url ?? url);
  if (!productUrl || !imageUrl) return null;

  const externalId = String(product.sku ?? "").trim() || productUrl;
  return {
    externalId,
    title,
    imageUrl,
    price,
    originalPrice: price,
    discount: 0,
    currency: "EGP",
    countryCode: "EG",
    storeName: STORE_NAME,
    category,
    productUrl,
    affiliateUrl: productUrl,
  };
}

async function collectForGroups(sitemaps, groups, all, stopAt, cache, stats) {
  for (const sitemap of sitemaps.slice(0, SITEMAP_LIMIT)) {
    if (all.size >= stopAt) break;
    let rows = cache.get(sitemap.url);
    if (!rows) {
      try {
        rows = parseSitemap(await fetchSitemap(sitemap.url));
        cache.set(sitemap.url, rows);
      } catch (error) {
        console.warn(`[jumia-ingest] sitemap failed: ${sitemap.url}`, error?.message || error);
        continue;
      }
    }

    for (const { category, queries } of groups) {
      for (const query of queries) {
        if (all.size >= stopAt) break;
        const token = urlToken(query).toLowerCase();
        const candidates = rows
          .filter((row) => row.url.toLowerCase().includes(token))
          .filter((row) => !PHONE_QUERIES.has(query) || !PHONE_ACCESSORY_URL_RE.test(row.url))
          .slice(0, PER_QUERY);
        if (!candidates.length) continue;

        for (let i = 0; i < candidates.length; i += FETCH_CONCURRENCY) {
          const batch = candidates.slice(i, i + FETCH_CONCURRENCY);
          await Promise.all(
            batch.map(async (candidate) => {
              try {
                const item = await fetchProduct(candidate.url, candidate.image, query, category);
                if (!item) return;
                const slug = `jumia-${slugify(item.externalId || item.productUrl)}`;
                if (!slug || all.has(slug)) return;
                all.set(slug, {
                  ...item,
                  slug,
                  categorySlug: slugify(item.category) || "general",
                });
              } catch (error) {
                stats.failures += 1;
                if (stats.failures <= 5) {
                  console.warn(`[jumia-ingest] product failed: ${candidate.url}`, error?.message || error);
                }
              }
            }),
          );
          if (all.size >= stopAt) break;
        }
      }
      if (all.size >= stopAt) break;
    }
  }
}

function itemSlug(item) {
  return `jumia-${slugify(item.externalId || item.productUrl)}`;
}

function mergeItems(primary, secondary, target = TARGET_PRODUCTS) {
  const merged = new Map();
  for (const item of [...primary, ...secondary]) {
    const slug = itemSlug(item);
    if (!slug || merged.has(slug)) continue;
    merged.set(slug, {
      ...item,
      slug,
      categorySlug: slugify(item.category) || "general",
    });
    if (merged.size >= target) break;
  }
  return Array.from(merged.values());
}

async function collectWithPlaywright() {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const all = new Map();
  let failures = 0;

  try {
    const context = await browser.newContext({
      userAgent: BOT_UA,
      locale: "en-US",
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);

    for (const { category, queries } of CATEGORY_QUERIES) {
      for (const query of queries) {
        const isIphone = query === "iphone";
        if (all.size >= TARGET_PRODUCTS) break;
        if (isIphone && all.size >= IPHONE_TARGET) continue;

        const url = `${BASE_URL}/catalog/?q=${encodeURIComponent(query)}`;
        try {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
          await page.waitForTimeout(1200);
          const rawCards = await page.evaluate(() => {
            const selectors = [
              "article.prd",
              "div.prd",
              '[data-testid="product-card"]',
              '[data-testid="productCard"]',
            ];
            let nodes = Array.from(document.querySelectorAll(selectors.join(",")));
            if (nodes.length === 0) {
              nodes = Array.from(document.querySelectorAll('a[href*=".html"]')).filter((node) =>
                node.querySelector("img"),
              );
            }
            return nodes.map((card) => {
              const anchor =
                card.tagName === "A"
                  ? card
                  : card.querySelector('a[href*=".html"]') || card.querySelector("a");
              const image = card.querySelector("img");
              const srcset = image?.getAttribute("srcset")?.split(",")[0]?.trim().split(/\s+/)[0];
              const title =
                card.querySelector("h3")?.textContent?.trim() ||
                image?.getAttribute("alt") ||
                card.querySelector(".name")?.textContent?.trim() ||
                card.querySelector('[data-testid="product-title"]')?.textContent?.trim() ||
                "";
              const priceText =
                card.querySelector(".prc")?.textContent?.trim() ||
                card.querySelector(".price")?.textContent?.trim() ||
                card.querySelector('[data-testid="price"]')?.textContent?.trim() ||
                card.textContent?.trim().slice(0, 240) ||
                "";
              return {
                title,
                price: priceText,
                image:
                  image?.getAttribute("data-src") ||
                  image?.getAttribute("data-lazy-src") ||
                  image?.getAttribute("src") ||
                  srcset ||
                  "",
                href: anchor?.getAttribute("href") || "",
                id:
                  card.getAttribute("data-product-id") ||
                  anchor?.getAttribute("data-product-id") ||
                  "",
              };
            });
          });

          for (const raw of rawCards) {
            const title = cleanTitle(raw.title);
            if (!title || !titleMatchesQuery(query, title)) continue;
            const price = parseMoney(raw.price);
            if (!price) continue;
            const imageUrl = resolveUrl(raw.image);
            const productUrl = resolveUrl(raw.href, BASE_URL);
            if (!isJumiaImage(imageUrl) || !productUrl.includes("jumia.com.eg")) continue;
            const externalId = raw.id || String(productUrl.match(/\/([^/]+\.html)/)?.[1] ?? productUrl);
            const slug = itemSlug({ externalId, productUrl });
            if (!slug || all.has(slug)) continue;
            all.set(slug, {
              externalId,
              title,
              imageUrl,
              price,
              originalPrice: price,
              discount: 0,
              currency: "EGP",
              countryCode: "EG",
              storeName: STORE_NAME,
              category,
              productUrl,
              affiliateUrl: productUrl,
              slug,
              categorySlug: slugify(category) || "general",
            });
            if (isIphone && all.size >= IPHONE_TARGET) break;
            if (all.size >= TARGET_PRODUCTS) break;
          }
        } catch (error) {
          failures += 1;
          if (failures <= 5) {
            console.warn(`[jumia-ingest] playwright query failed: ${query}`, error?.message || error);
          }
        }
      }
    }
    await context.close();
  } finally {
    await browser.close();
  }

  console.log(
    `[jumia-ingest] playwright strategy: ${all.size} products, ${failures} failed queries`,
  );
  return mergeItems([], Array.from(all.values()));
}

async function collectProducts() {
  const sitemaps = await fetchSitemapIndex();
  const all = new Map();
  const cache = new Map();
  const stats = { failures: 0 };

  await collectForGroups(
    sitemaps,
    [{ category: "phones", queries: ["iphone"] }],
    all,
    IPHONE_TARGET,
    cache,
    stats,
  );

  const otherGroups = CATEGORY_QUERIES.map((group) => ({
    category: group.category,
    queries: group.queries.filter((query) => query !== "iphone"),
  })).filter((group) => group.queries.length > 0);

  await collectForGroups(sitemaps, otherGroups, all, TARGET_PRODUCTS, cache, stats);
  return Array.from(all.values()).slice(0, TARGET_PRODUCTS);
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

  let items = [];
  if (USE_PLAYWRIGHT) {
    try {
      items = await collectWithPlaywright();
    } catch (error) {
      console.warn("[jumia-ingest] playwright unavailable:", error?.message || error);
    }
    if (items.length < TARGET_PRODUCTS) {
      const sitemapItems = await collectProducts();
      items = mergeItems(items, sitemapItems);
    }
  } else {
    items = await collectProducts();
  }

  if (items.length === 0) {
    console.warn("[jumia-ingest] no products fetched");
    return;
  }

  if (process.argv.includes("--dry-run")) {
    const withImages = items.filter((item) => isJumiaImage(item.imageUrl)).length;
    const iphoneCount = items.filter(
      (item) => /iphone/i.test(item.title) && !PHONE_ACCESSORY_RE.test(item.title),
    ).length;
    console.log(`[jumia-ingest] dry run: ${items.length} products, ${withImages} Jumia CDN images`);
    console.log(`[jumia-ingest] iphone products: ${iphoneCount}`);
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
