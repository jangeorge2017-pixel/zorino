/**
 * Admitad Publisher API-driven product ingestion.
 *
 * Flow:
 *   1. Authenticate via OAuth (client credentials)
 *   2. Discover connected ad-spaces (websites)
 *   3. Discover programs with product feeds for each website
 *   4. Fetch ALL products from discovered XML feeds (streaming, paginated)
 *   5. Normalize into Zorino's NormalizedCatalogItem schema
 *   6. Save/update into Supabase (products + prices + lowest_prices_today)
 *
 * Deduplication: by feed offer ID (external product id).
 * Rate-limit: built into api.ts (sliding window, 90 req/min).
 * Token refresh: built into auth.ts (auto-refresh before expiry).
 */

import type { AdmitadFeedOffer } from "./types";
import type { NormalizedCatalogItem, ProviderOffer } from "@/lib/integration/catalog-types";
import {
  listWebsites,
  listCampaignsForWebsite,
  type AdmitadCampaign,
  type AdmitadFeedInfo,
} from "./api";
import { getAccessToken } from "./auth";

// ---------------------------------------------------------------------------
// Feed XML streaming parser (reuses logic from feed-fetcher.ts)
// ---------------------------------------------------------------------------

function extractTag(xml: string, tag: string): string | null {
  // Try g: namespace first (Google Merchant format), then plain tag
  const gTag = `g:${tag}`;
  const gRegex = new RegExp(`<${gTag}>([^<]*)</${gTag}>`);
  const gMatch = xml.match(gRegex);
  if (gMatch) return gMatch[1].trim();
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function parsePriceValue(raw: string): number | null {
  if (!raw) return null;
  // "5.82 USD" → 5.82
  const num = parseFloat(raw.replace(/[^\d.]/g, ""));
  return isNaN(num) || num <= 0 ? null : num;
}

function parseOfferElement(xml: string): AdmitadFeedOffer | null {
  let id: string | null = null;
  let name: string | null = null;
  let priceStr: string | null = null;
  let oldpriceStr: string | null = null;
  let currencyId: string | null = null;
  let url: string | null = null;
  let image: string | null = null;
  let vendor: string | null = null;
  let description: string | null = null;
  let modified_time: string | null = null;

  const offerMatch = xml.match(/<offer\s+id="(\d+)">/);
  if (offerMatch) {
    // Admitad legacy <offer> format
    id = offerMatch[1];
    name = extractTag(xml, "name");
    priceStr = extractTag(xml, "price");
    oldpriceStr = extractTag(xml, "oldprice");
    currencyId = extractTag(xml, "currencyId");
    url = extractTag(xml, "url");
    image = extractTag(xml, "image");
    vendor = extractTag(xml, "vendor");
    description = extractTag(xml, "description");
    modified_time = extractTag(xml, "modified_time");
  } else {
    // Google Merchant / Atom <entry> format
    id = extractTag(xml, "id");
    name = extractTag(xml, "title");
    priceStr = extractTag(xml, "price");
    url = extractTag(xml, "link");
    image = extractTag(xml, "image_link");
    description = extractTag(xml, "description");
    vendor = null;
    oldpriceStr = null;
    modified_time = null;
    // Parse currency from price string like "5.82 USD"
    const priceMatch = priceStr?.match(/([A-Z]{3})$/);
    currencyId = priceMatch ? priceMatch[1] : "USD";
  }

  if (!id || !name || !priceStr) return null;

  const price = parsePriceValue(priceStr);
  if (!price) return null;

  const oldprice =
    oldpriceStr && oldpriceStr !== "None" ? parsePriceValue(oldpriceStr) : null;

  return {
    id,
    name: decodeXmlEntities(name),
    price,
    oldprice: oldprice && !isNaN(oldprice) ? oldprice : null,
    currencyId: currencyId || "USD",
    description: description ? decodeXmlEntities(description) : "",
    vendor: vendor && vendor !== "None" ? decodeXmlEntities(vendor) : "",
    url: url ? decodeXmlEntities(url) : "",
    image: image ? decodeXmlEntities(image) : "",
    modified_time: modified_time || "",
  };
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

async function fetchFeedStreaming(feedUrl: string): Promise<AdmitadFeedOffer[]> {
  const resp = await fetch(feedUrl, {
    headers: { "User-Agent": "ZorinoBot/2.0-admitad-api" },
    signal: AbortSignal.timeout(180_000), // 3 min for large feeds
  });

  if (!resp.ok) throw new Error(`Feed HTTP ${resp.status}`);
  if (!resp.body) throw new Error("Feed response body is null");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  const offers = new Map<string, AdmitadFeedOffer>();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Match both <offer id="...">...</offer> and <entry>...</entry>
    const offerRegex = /<(?:offer\s+id="\d+"|entry)>[\s\S]*?<\/(?:offer|entry)>/g;
    let match;
    while ((match = offerRegex.exec(buffer)) !== null) {
      const offer = parseOfferElement(match[0]);
      if (offer && !offers.has(offer.id)) {
        offers.set(offer.id, offer);
      }
    }

    const lastIncomplete = Math.max(buffer.lastIndexOf("<offer"), buffer.lastIndexOf("<entry"));
    buffer = lastIncomplete > 0 ? buffer.slice(lastIncomplete) : "";
  }

  // Flush remaining
  if (buffer.includes("<offer") || buffer.includes("<entry>")) {
    const offer = parseOfferElement(buffer);
    if (offer && !offers.has(offer.id)) {
      offers.set(offer.id, offer);
    }
  }

  return Array.from(offers.values());
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function feedOfferToCatalogItem(
  offer: AdmitadFeedOffer,
  campaign: AdmitadCampaign,
  feedInfo: AdmitadFeedInfo,
): NormalizedCatalogItem {
  const storeSlug = campaign.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  const discount =
    offer.oldprice && offer.oldprice > offer.price
      ? Math.round(((offer.oldprice - offer.price) / offer.oldprice) * 100)
      : 0;

  const offer_: ProviderOffer = {
    providerId: "admitad",
    storeSlug,
    storeName: campaign.name,
    externalId: offer.id,
    price: offer.price,
    originalPrice: offer.oldprice ?? offer.price,
    currency: offer.currencyId,
    countryCode: "US",
    affiliateUrl: offer.url,
    productUrl: offer.url,
    inStock: true,
  };

  return {
    id: `admitad-${campaign.id}-${offer.id}`,
    slug: `admitad-${campaign.id}-${offer.id}`,
    title: offer.name,
    imageUrl: offer.image || "",
    emoji: "🛍️",
    categorySlug: "general",
    rating: 0,
    reviewCount: 0,
    countryCode: "US",
    currency: offer.currencyId,
    price: offer.price,
    originalPrice: offer.oldprice ?? offer.price,
    discount,
    discountType: "percentage",
    providerIds: ["admitad"],
    offers: [offer_],
    fetchedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Supabase persistence
// ---------------------------------------------------------------------------

async function saveCatalogItems(items: NormalizedCatalogItem[]): Promise<number> {
  const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    console.warn("[admitad-ingest] Supabase not configured, skipping DB save");
    return 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Get or create the "admitad" store
  let storeId: string | null = null;
  const { data: existingStore } = await db
    .from("stores")
    .select("id")
    .eq("slug", "admitad")
    .single();

  if (existingStore) {
    storeId = existingStore.id;
  } else {
    const { data: newStore } = await db
      .from("stores")
      .insert({
        name: "Admitad (Alibaba)",
        name_ar: "أدميتاد (علي بابا)",
        slug: "admitad",
        website: "https://admitad.com",
        integration_type: "partner",
        logo_url: "/stores/alibaba.svg",
        logo_initial: "Ad",
        supported_regions: ["US"],
        supported_currencies: ["USD"],
        is_active: true,
      })
      .select("id")
      .single();
    storeId = newStore?.id ?? null;
  }

  if (!storeId) {
    console.error("[admitad-ingest] failed to resolve/create admitad store");
    return 0;
  }

  let saved = 0;

  // Process in batches of 200 for Supabase upsert limits
  const BATCH = 200;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);

    // Upsert products
    const productRows = batch.map((item) => ({
      name: item.title,
      slug: item.slug,
      description: "",
      image_url: item.imageUrl,
      emoji: item.emoji,
      category_slug: item.categorySlug,
      brand: null,
      rating: item.rating || null,
      review_count: item.reviewCount,
      currency: item.currency,
      country_code: item.countryCode,
      in_stock: true,
      is_active: true,
    }));

    const { data: upsertedProducts, error: prodErr } = await db
      .from("products")
      .upsert(productRows, { onConflict: "slug", ignoreDuplicates: false })
      .select("id, slug");

    if (prodErr) {
      console.error(`[admitad-ingest] product upsert error (batch ${i}):`, prodErr.message);
      continue;
    }

    if (!upsertedProducts?.length) continue;

    // Build price rows
    const slugToId = new Map<string, string>();
    for (const p of upsertedProducts) slugToId.set(p.slug, p.id);

    const priceRows: unknown[] = [];
    for (const item of batch) {
      const productId = slugToId.get(item.slug);
      if (!productId) continue;
      const offer = item.offers[0];
      if (!offer) continue;

      priceRows.push({
        product_id: productId,
        store_id: storeId,
        price: offer.price,
        original_price: offer.originalPrice,
        currency: offer.currency,
        country_code: offer.countryCode,
        external_url: offer.affiliateUrl || offer.productUrl,
        external_product_id: offer.externalId,
        in_stock: offer.inStock,
        is_current: true,
      });
    }

    if (priceRows.length > 0) {
      await db
        .from("prices")
        .upsert(priceRows, {
          onConflict: "product_id,store_id,country_code,currency",
          ignoreDuplicates: false,
        });
    }

    // Upsert lowest_prices_today
    const lowestRows: unknown[] = [];
    for (const item of batch) {
      const productId = slugToId.get(item.slug);
      if (!productId) continue;
      const offer = item.offers[0];
      if (!offer) continue;

      lowestRows.push({
        product_id: productId,
        country_code: item.countryCode,
        currency: item.currency,
        product_name: item.title,
        product_slug: item.slug,
        image_url: item.imageUrl,
        emoji: item.emoji,
        lowest_price: offer.price,
        original_price: offer.originalPrice,
        discount_percent: item.discount,
        savings_amount: Math.max(0, offer.originalPrice - offer.price),
        store_id: storeId,
        store_name: offer.storeName,
        provider: "admitad",
        affiliate_url: offer.affiliateUrl,
        external_url: offer.productUrl,
        is_new_low: false,
        price_recorded_at: new Date().toISOString(),
        computed_at: new Date().toISOString(),
      });
    }

    if (lowestRows.length > 0) {
      await db
        .from("lowest_prices_today")
        .upsert(lowestRows, {
          onConflict: "product_id,country_code,currency",
          ignoreDuplicates: false,
        });
    }

    saved += batch.length;
  }

  return saved;
}

// ---------------------------------------------------------------------------
// Main ingestion pipeline
// ---------------------------------------------------------------------------

export type IngestionResult = {
  authenticated: boolean;
  websitesFound: number;
  programsDiscovered: number;
  feedsWithProducts: number;
  totalProducts: number;
  productsSaved: number;
  errors: string[];
};

export async function runAdmitadIngestion(
  options: { maxFeeds?: number; maxProductsPerFeed?: number; dryRun?: boolean } = {},
): Promise<IngestionResult> {
  const { maxFeeds = 50, maxProductsPerFeed = 5000, dryRun = false } = options;
  const result: IngestionResult = {
    authenticated: false,
    websitesFound: 0,
    programsDiscovered: 0,
    feedsWithProducts: 0,
    totalProducts: 0,
    productsSaved: 0,
    errors: [],
  };

  // 1. Authenticate
  console.log("[admitad-ingest] Step 1: Authenticating...");
  try {
    await getAccessToken();
    result.authenticated = true;
  } catch (err) {
    result.errors.push(
      `Auth failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return result;
  }
  console.log("[admitad-ingest] Authentication successful");

  // 2. Discover websites
  console.log("[admitad-ingest] Step 2: Discovering websites...");
  let websites;
  try {
    websites = await listWebsites();
    result.websitesFound = websites.length;
  } catch (err) {
    result.errors.push(
      `Websites discovery failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return result;
  }

  if (websites.length === 0) {
    result.errors.push("No websites/ad-spaces found for this account");
    return result;
  }
  console.log(`[admitad-ingest] Found ${websites.length} websites`);

  // 3. Discover programs with feeds for each website
  console.log("[admitad-ingest] Step 3: Discovering programs with product feeds...");
  const allFeeds: {
    campaign: AdmitadCampaign;
    feed: AdmitadFeedInfo;
    websiteId: number;
  }[] = [];

  for (const website of websites) {
    try {
      const campaigns = await listCampaignsForWebsite(website.id, "products");
      result.programsDiscovered += campaigns.length;

      for (const campaign of campaigns) {
        if (!campaign.feeds_info?.length) continue;
        for (const feed of campaign.feeds_info) {
          allFeeds.push({ campaign, feed, websiteId: website.id });
        }
      }
    } catch (err) {
      result.errors.push(
        `Programs for website ${website.id} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.log(
    `[admitad-ingest] Found ${allFeeds.length} feeds across ${result.programsDiscovered} programs`,
  );

  if (allFeeds.length === 0) {
    result.errors.push("No product feeds discovered from any connected program");
    return result;
  }

  // 4. Fetch products from each feed
  console.log("[admitad-ingest] Step 4: Fetching products from feeds...");
  const allItems: NormalizedCatalogItem[] = [];
  const seenOfferIds = new Set<string>();

  const feedsToFetch = allFeeds.slice(0, maxFeeds);

  for (let fi = 0; fi < feedsToFetch.length; fi++) {
    const { campaign, feed, websiteId } = feedsToFetch[fi];
    const feedUrl = feed.xml_link?.replace("http://", "https://");
    if (!feedUrl) continue;

    console.log(
      `[admitad-ingest] Feed ${fi + 1}/${feedsToFetch.length}: "${feed.name}" from "${campaign.name}"...`,
    );

    try {
      const offers = await fetchFeedStreaming(feedUrl);
      result.feedsWithProducts++;

      let feedCount = 0;
      for (const offer of offers.slice(0, maxProductsPerFeed)) {
        if (seenOfferIds.has(offer.id)) continue;
        seenOfferIds.add(offer.id);

        allItems.push(feedOfferToCatalogItem(offer, campaign, feed));
        feedCount++;
      }

      result.totalProducts += feedCount;
      console.log(
        `[admitad-ingest] Feed "${feed.name}": ${feedCount} unique products`,
      );
    } catch (err) {
      result.errors.push(
        `Feed "${feed.name}" fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.log(`[admitad-ingest] Total unique products: ${result.totalProducts}`);

  // 5. Save to database
  if (dryRun) {
    console.log("[admitad-ingest] DRY RUN — skipping DB save");
    result.productsSaved = result.totalProducts;
    return result;
  }

  console.log("[admitad-ingest] Step 5: Saving to database...");
  try {
    result.productsSaved = await saveCatalogItems(allItems);
    console.log(`[admitad-ingest] Saved ${result.productsSaved} products to database`);
  } catch (err) {
    result.errors.push(
      `DB save failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return result;
}
