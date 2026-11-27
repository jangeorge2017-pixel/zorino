/**
 * Bridge between the Supabase product catalog (imported by cron sync jobs)
 * and the NormalizedCatalogItem / SearchResultItem formats used by the
 * unified homepage feed and global search engine.
 *
 * Reads from `lowest_prices_today` joined with `products` to get category
 * metadata. Returns NormalizedCatalogItems that feed every homepage section,
 * the /deals page, the Hero orbit, and the search engine's DB fallback.
 */

import {
  createSupabaseAnonClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/server";
import type { SupabaseDb } from "@/lib/supabase/config";
import type { NormalizedCatalogItem, ProviderOffer } from "@/lib/integration/catalog-types";
import type { ProductionProviderId } from "@/lib/integration/constants";
import type { SearchResultItem } from "@/lib/data/homepage";
import {
  normalizeProductImageUrl,
  PRODUCT_IMAGE_PLACEHOLDER,
} from "@/lib/images/product-image";
import { getSearchCacheVersion } from "@/lib/search/cache-version";
import { resolveMarketplaceId } from "@/lib/search/resolve-marketplace-id";
import { toProductCard } from "@/lib/search/types";
import { setBoundedCacheEntry } from "@/lib/utils/bounded-map-cache";
import { LIVE_PROVIDER_IDS } from "@/lib/providers/registry";
import {
  buildGroupOrFilter,
  buildIndexedSearchOrFilter,
  buildCombinedSearchOrFilter,
  buildProductCategoryOrFilterWithColumns,
  buildValuesOrFilter,
  combinedSearchTokens,
  escapeRegexToken,
  querySearchTokens,
  strictQueryTokenGroups,
  type StrictTokenGroup,
} from "@/lib/integration/word-match-filter";
import { balanceFlatMarketplaceList } from "@/lib/search/marketplace-balance";
import {
  cleanSearchableText,
  normalizeText,
} from "@/lib/search/text-normalization";
import {
  currencyCodes,
  type CurrencyCode,
} from "@/lib/international/config";
import {
  CATALOG_COUNTRIES,
  CATALOG_CURRENCIES,
} from "@/lib/integration/catalog-scope";
import {
  ACCESSORY_TERM_RE,
  HANDSET_EXTRA_TERM_RE,
  HANDSET_PRICE_FLOOR_USD,
  isHandsetQuery,
  passesStrictDeviceGuard,
} from "@/lib/search/accessory-exclusion";
import {
  analyzeStrictIntent,
  requiredBrandTokensForQuery,
  strictTitleRank,
  strictTitleState,
  type StrictIntent,
} from "@/lib/search/relevance";
import {
  CATALOG_COUNT_FRESHNESS_MS,
  getCatalogCount,
  getCatalogCountAgeMs,
  setCatalogCount,
} from "@/lib/integration/catalog-count";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseDb): any {
  return client;
}

function normalizedWholeWordInTitle(hay: string, token: string): boolean {
  const normalizedHay = normalizeText(hay);
  const normalizedToken = normalizeText(token).trim();
  if (!normalizedToken) return false;
  const esc = escapeRegexToken(normalizedToken);
  return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}($|[^\\p{L}\\p{N}])`, "iu").test(
    normalizedHay,
  );
}

function phraseMatchScore(name: string, query: string): number {
  const normalizedName = normalizeText(name);
  const tokens = querySearchTokens(query);
  if (tokens.length === 0) return 0;
  const normalizedTokens = tokens.map((token) => normalizeText(token).trim()).filter(Boolean);
  if (normalizedTokens.length === 0) return 0;
  const phrase = normalizedTokens.join(" ");
  if (normalizedName.includes(phrase)) return 1000 + normalizedTokens.length * 100;
  return 0;
}

function combinedRelevanceScore(
  name: string,
  query: string,
  originalQuery?: string,
): number {
  const phraseScore = Math.max(
    phraseMatchScore(name, query),
    phraseMatchScore(name, originalQuery ?? ""),
  );
  const tokens = combinedSearchTokens(query, originalQuery);
  const overlap = tokens.filter((token) => normalizedWholeWordInTitle(name, token)).length;
  return phraseScore + overlap * 10;
}

function passesStrictTitle(name: string, intent: StrictIntent | null): boolean {
  return !intent || strictTitleState(name, intent) !== "rejected";
}

const STRICT_TIER1_MIN_RESULTS = 12;
const STRICT_SEARCH_ROW_COLUMNS =
  "id, product_id, product_name, product_slug, image_url, emoji, lowest_price, original_price, discount_percent, store_name, provider, affiliate_url, external_url, country_code, currency";

const BRAND_FAMILIES: ReadonlyArray<{
  family: string;
  tokens: readonly string[];
}> = [
  { family: "apple", tokens: ["apple", "iphone", "ipad", "macbook"] },
  { family: "samsung", tokens: ["samsung", "galaxy"] },
  { family: "xiaomi", tokens: ["xiaomi", "redmi", "poco"] },
  { family: "oppo", tokens: ["oppo"] },
  { family: "vivo", tokens: ["vivo"] },
  { family: "oneplus", tokens: ["oneplus"] },
  { family: "google", tokens: ["google", "pixel"] },
  { family: "huawei", tokens: ["huawei"] },
  { family: "sony", tokens: ["sony", "playstation", "ps5"] },
  { family: "nokia", tokens: ["nokia"] },
  { family: "motorola", tokens: ["motorola", "moto"] },
];

function strictTitleTokenGroups(
  query: string,
  ...originalQueries: ReadonlyArray<string | undefined>
): StrictTokenGroup[] {
  return strictQueryTokenGroups(query, ...originalQueries);
}

function normalizedGroupVariants(group: StrictTokenGroup): string[] {
  const seen = new Set<string>();
  const variants: string[] = [];
  for (const variant of group.variants) {
    const normalized = cleanSearchableText(variant);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    variants.push(normalized);
  }
  return variants;
}

function groupMatchesTitle(group: StrictTokenGroup, title: string): boolean {
  const cleanTitle = cleanSearchableText(title);
  return normalizedGroupVariants(group).some((variant) =>
    normalizedWholeWordInTitle(cleanTitle, variant),
  );
}

function brandFamiliesForValues(values: readonly string[]): Set<string> {
  const normalized = new Set(values.map((value) => cleanSearchableText(value)));
  const families = new Set<string>();
  for (const rule of BRAND_FAMILIES) {
    if (rule.tokens.some((token) => normalized.has(cleanSearchableText(token)))) {
      families.add(rule.family);
    }
  }
  return families;
}

function brandFamiliesForGroups(groups: readonly StrictTokenGroup[]): Set<string> {
  const values = groups.flatMap((group) => normalizedGroupVariants(group));
  return brandFamiliesForValues(values);
}

function brandFamiliesForTitle(title: string): Set<string> {
  const cleanTitle = cleanSearchableText(title);
  const families = new Set<string>();
  for (const rule of BRAND_FAMILIES) {
    if (
      rule.tokens.some((token) =>
        normalizedWholeWordInTitle(cleanTitle, cleanSearchableText(token)),
      )
    ) {
      families.add(rule.family);
    }
  }
  return families;
}

function isBrandGroup(group: StrictTokenGroup): boolean {
  return brandFamiliesForGroups([group]).size > 0;
}

function groupHasNoun(group: StrictTokenGroup): boolean {
  return normalizedGroupVariants(group).some(
    (variant) => /[a-z]{3,}/.test(variant) && !/^\d+$/.test(variant),
  );
}

function strictTitleTierForGroups(
  title: string,
  groups: readonly StrictTokenGroup[],
): 1 | 2 | 0 {
  if (groups.length === 0) return 0;

  const queryFamilies = brandFamiliesForGroups(groups);
  const titleFamilies = brandFamiliesForTitle(title);
  for (const family of titleFamilies) {
    if (queryFamilies.size > 0 && !queryFamilies.has(family)) return 0;
  }

  const matches = groups.map((group) => groupMatchesTitle(group, title));
  if (matches.every(Boolean)) return 1;

  const nonBrandGroups = groups.filter((group) => !isBrandGroup(group));
  const nounGroups = nonBrandGroups.filter((group) => groupHasNoun(group));
  const tierTwoGroups = nounGroups.length > 0 ? nounGroups : nonBrandGroups;
  if (tierTwoGroups.length === 0) return 0;
  if (
    queryFamilies.size > 0 &&
    ![...queryFamilies].some((family) => titleFamilies.has(family))
  ) {
    return 0;
  }
  return tierTwoGroups.some((group) => groupMatchesTitle(group, title)) ? 2 : 0;
}

function strictCandidateFilterForGroups(
  groups: readonly StrictTokenGroup[],
): string {
  if (groups.length === 0) return "";
  const strictClauses = groups.map((group) => buildGroupOrFilter(group));
  const strict = strictClauses.length === 1
    ? strictClauses[0]!
    : `and(${strictClauses.join(",")})`;

  const nonBrandGroups = groups.filter((group) => !isBrandGroup(group));
  const nounGroups = nonBrandGroups.filter((group) => groupHasNoun(group));
  const tierTwoGroups = nounGroups.length > 0 ? nounGroups : nonBrandGroups;
  if (tierTwoGroups.length === 0) return strict;

  const tierTwoClauses = tierTwoGroups.map((group) => buildGroupOrFilter(group)).join(",");
  const nounFilter = tierTwoGroups.length === 1
    ? tierTwoClauses
    : `or(${tierTwoClauses})`;
  const queryFamilies = brandFamiliesForGroups(groups);
  const brandValues = BRAND_FAMILIES.filter((rule) =>
    queryFamilies.has(rule.family),
  ).flatMap((rule) => [...rule.tokens]);
  const brandFilter = brandValues.length > 0 ? buildValuesOrFilter(brandValues) : "";
  const tierTwo = brandFilter ? `and(${brandFilter},${nounFilter})` : nounFilter;
  return `${strict},${tierTwo}`;
}

function storeKeyForResult(item: SearchResultItem): string {
  const providerId = resolveMarketplaceId(item.storeSlug || item.store);
  return `${providerId}|${item.store.trim().toLowerCase()}`;
}

let categorySearchColumns: readonly string[] | null = null;

async function categoryProductIdOrFilter(
  supabase: SupabaseDb,
  queries: ReadonlyArray<string | undefined>,
  limit: number,
): Promise<string> {
  const columnSets: ReadonlyArray<readonly string[]> = categorySearchColumns
    ? [categorySearchColumns]
    : [
        ["title"],
        ["name"],
        ["title", "title_ar", "category_slug"],
        ["name", "name_ar", "category_slug"],
        ["title", "category_slug"],
        ["name", "category_slug"],
      ];

  for (const columns of columnSets) {
    const categoryFilter = buildProductCategoryOrFilterWithColumns(queries, columns);
    if (!categoryFilter) continue;
    const { data, error } = await db(supabase)
      .from("products")
      .select("id")
      .or(categoryFilter)
      .limit(Math.min(Math.max(limit * 4, 60), 500));
    if (error) continue;
    categorySearchColumns = columns;
    const ids = (data ?? [])
      .map((row: { id?: unknown }) => row.id)
      .filter((id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9_-]+$/.test(id));
    return ids.length > 0 ? `product_id.in.(${ids.join(",")})` : "";
  }

  return "";
}

function appendOrFilter(base: string, extra: string): string {
  if (!extra) return base;
  return base ? `${base},${extra}` : extra;
}

function sortByCombinedRelevance(
  results: SearchResultItem[],
  query: string,
  originalQuery?: string,
): void {
  const strictIntent = analyzeStrictIntent(query, originalQuery);
  const groups = strictTitleTokenGroups(query, originalQuery);
  const tierCache = new Map<string, 1 | 2 | 0>();
  const tierOf = (name: string): 1 | 2 | 0 => {
    const cached = tierCache.get(name);
    if (cached !== undefined) return cached;
    const tier = strictTitleTierForGroups(name, groups);
    tierCache.set(name, tier);
    return tier;
  };
  results.sort((a, b) => {
    const tierDelta = tierOf(b.name) - tierOf(a.name);
    if (tierDelta !== 0) return tierDelta;
    const strictDelta = strictIntent
      ? strictTitleRank(b.name, strictIntent) - strictTitleRank(a.name, strictIntent)
      : 0;
    if (strictDelta !== 0) return strictDelta;
    const scoreDelta =
      combinedRelevanceScore(b.name, query, originalQuery) -
      combinedRelevanceScore(a.name, query, originalQuery);
    if (scoreDelta !== 0) return scoreDelta;
    return b.discount - a.discount || a.price - b.price;
  });
}

function selectStrictTierRows<T extends { product_name: string }>(
  rows: readonly T[],
  groups: readonly StrictTokenGroup[],
): T[] {
  const tiered = rows
    .map((row) => ({ row, tier: strictTitleTierForGroups(row.product_name, groups) }))
    .filter((entry): entry is { row: T; tier: 1 | 2 } => entry.tier > 0);
  const tierOne = tiered.filter((entry) => entry.tier === 1);
  return (tierOne.length >= STRICT_TIER1_MIN_RESULTS ? tierOne : tiered).map(
    (entry) => entry.row,
  );
}

type LowestPriceRow = {
  id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  image_url: string;
  emoji: string | null;
  lowest_price: number;
  original_price: number | null;
  discount_percent: number;
  store_name: string;
  provider: string | null;
  affiliate_url: string | null;
  external_url: string | null;
  country_code: string;
  currency: string;
  category_slug?: string | null;
};

/** Infer a useful category from the product name when the DB stores "general". */
function inferCategoryFromName(name: string): string {
  const lower = name.toLowerCase();
  if (/\b(phone|iphone|samsung|galaxy|xiaomi|redmi|oppo|vivo|oneplus|pixel)\b/.test(lower)) return "phones";
  if (/\b(laptop|macbook|notebook|chromebook|thinkpad|surface|dell|hp pavilion)\b/.test(lower)) return "laptops";
  if (/\b(console|playstation|xbox|nintendo|gaming|controller|ps5|ps4|steam deck)\b/.test(lower)) return "gaming";
  if (/\b(tv|television|monitor|display|4k|oled|qled|hisense|tcl)\b/.test(lower)) return "tvs";
  if (/\b(watch|band|tracker|earbuds|headphones|airpods|fitbit|garmin)\b/.test(lower)) return "wearables";
  if (/\b(dress|shirt|jeans|jacket|shoes|sneakers|boots|sandals|fashion|clothing|apparel)\b/.test(lower)) return "fashion";
  if (/\b(home|kitchen|blender|vacuum|air fryer|mattress|pillow|furniture|lamp)\b/.test(lower)) return "home";
  return "electronics";
}

function rowToCatalogItem(row: LowestPriceRow): NormalizedCatalogItem {
  const providerId = resolveMarketplaceId(row.provider ?? row.store_name) as ProductionProviderId;
  const affiliateUrl = row.affiliate_url ?? row.external_url ?? "";
  const originalPrice = Number(row.original_price ?? row.lowest_price);
  const price = Number(row.lowest_price);
  const discount =
    originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0;

  const offer: ProviderOffer = {
    providerId,
    storeSlug: providerId,
    storeName: row.store_name,
    externalId: row.product_id,
    price,
    originalPrice,
    currency: row.currency,
    countryCode: row.country_code,
    productUrl: affiliateUrl,
    affiliateUrl,
    inStock: true,
  };

  const rawCategory = row.category_slug;
  const categorySlug =
    rawCategory && rawCategory !== "general"
      ? rawCategory
      : inferCategoryFromName(row.product_name);

  return {
    id: `db-${row.product_id}`,
    slug: row.product_slug,
    title: row.product_name,
    imageUrl: normalizeProductImageUrl(row.image_url),
    emoji: row.emoji ?? "ðŸ›ï¸",
    categorySlug,
    rating: 0,
    reviewCount: 0,
    countryCode: row.country_code,
    currency: row.currency,
    price,
    originalPrice,
    discount,
    discountType: "percentage",
    offers: [offer],
    providerIds: [providerId],
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Providers that carry real, image-bearing products in `lowest_prices_today`.
 * Includes active live providers plus Amazon/Amazon-EG so indirectly ingested
 * DB rows can surface without changing the Phase 5 direct-connector gate.
 */
const REAL_CATALOG_PROVIDERS = Array.from(
  new Set([...LIVE_PROVIDER_IDS, "amazon", "amazon-eg"]),
);

/**
 * How long a discovered merchant set stays cached (ms). The merchant universe
 * changes only when an ingestion run adds/removes a store, so a long TTL is
 * safe and keeps the expensive scan off the homepage hot path.
 */
const MERCHANT_NAMES_TTL_MS = 30 * 60_000;

/**
 * Concurrent keyset workers used to enumerate the merchant universe.
 * 64 partitions the ~123K-row table into ~2 pages per worker, so the cold scan
 * finishes in a few seconds even on 0.1-CPU free instances; 16 workers took
 * ~10s and could exceed the DB budget on the Docker service.
 */
const MERCHANT_SCAN_WORKERS = 64;
/** Page size per worker (Supabase/PostgREST caps responses at 1000 rows). */
const MERCHANT_SCAN_PAGE = 1000;
/** Attempts per page before a worker stops (transient 5xx/timeouts). */
const MERCHANT_SCAN_PAGE_ATTEMPTS = 2;

let merchantNamesCache: { names: string[]; at: number } | null = null;
let merchantNamesInflight: Promise<string[]> | null = null;

/** Test-only seam: clear the merchant-name cache. */
export function resetMerchantNamesCacheForTests(): void {
  merchantNamesCache = null;
  merchantNamesInflight = null;
}

/**
 * Enumerate the distinct real merchants present in `lowest_prices_today`.
 *
 * Primary path: the `real_merchant_names` RPC (migration 033) computes the
 * distinct set in ONE server-side scan and returns it as text[]. With the
 * covering index from the same migration this is sub-second, which keeps the
 * whole DB leg inside the homepage budget even on a 0.1-CPU instance.
 *
 * Fallback (RPC missing / errors): paginate the full real-provider set with
 * keyset scans and dedupe on store_name. That path is correct but slow, so it
 * exists only so a deployment can run before the migration is applied.
 *
 * IMPORTANT: rows are heavily concentrated by merchant (one merchant can own
 * tens of thousands of rows, another only a handful at the very tail), so a
 * bounded "first N" slice would miss whole merchants.
 *
 * Reliability (verified against the live 120K-row table):
 * - The keyset fallback must use the array-form `.in("provider", [...])` filter.
 *   The string-form `.or("provider.in.(...)")` is planned as a PostgREST `or`
 *   filter and consistently 500s with a statement timeout, which silently
 *   emptied the merchant universe and dropped every persisted row from the
 *   homepage catalog.
 * - Page by KEY SET (`id > cursor`), never by OFFSET. Deep `.range()` offsets
 *   also hit the statement timeout (verified at offset 6000+), so keyset +
 *   random-UUID partitions gives the same coverage without deep scans.
 * - Result is cached process-wide (shared by the catalog leg and the stats
 *   leg) and de-duplicated while in flight, so the lookup runs at most once per
 *   TTL per instance instead of twice per 5-min cache cycle.
 */
export async function getRealMerchantNames(supabase?: SupabaseDb): Promise<string[]> {
  const client = supabase ?? createSupabaseAnonClient();
  if (!client) return [];

  const now = Date.now();
  if (merchantNamesCache && now - merchantNamesCache.at < MERCHANT_NAMES_TTL_MS) {
    return merchantNamesCache.names;
  }
  if (merchantNamesInflight) return merchantNamesInflight;

  merchantNamesInflight = loadRealMerchantNames(client)
    .then((names) => {
      // Only cache a non-empty result; an empty scan is more likely a transient
      // outage than a genuinely empty table, and must be retried next call.
      if (names.length > 0) merchantNamesCache = { names, at: Date.now() };
      return names;
    })
    .finally(() => {
      merchantNamesInflight = null;
    });

  return merchantNamesInflight;
}

/**
 * RPC-first merchant lookup. Returns null only when the RPC is unavailable so
 * the caller can fall back to the keyset scan; a successful empty result is
 * meaningful (the real table has no merchants in scope).
 */
async function loadRealMerchantNames(client: SupabaseDb): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any).rpc("real_merchant_names", {
    p_countries: [...CATALOG_COUNTRIES],
    p_currencies: [...CATALOG_CURRENCIES],
    p_providers: [...REAL_CATALOG_PROVIDERS],
  });
  if (error) {
    console.error("[db] real_merchant_names rpc error:", error.code ?? error.message);
    return scanRealMerchantNames(client);
  }
  if (!Array.isArray(data)) {
    console.error("[db] real_merchant_names rpc unexpected shape");
    return scanRealMerchantNames(client);
  }
  console.error("[db] real_merchant_names rpc ok count:", data.length);
  return data
    .map((name: unknown) => String(name ?? "").trim())
    .filter((name: string) => name.length > 0);
}

async function scanRealMerchantNames(client: SupabaseDb): Promise<string[]> {
  const names = new Set<string>();

  interface ScanRow {
    id: string;
    store_name: string | null;
  }

  const fetchPage = async (
    cursor: string | null,
    upper: string | null,
  ): Promise<ScanRow[] | null> => {
    for (let attempt = 0; attempt < MERCHANT_SCAN_PAGE_ATTEMPTS; attempt++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (client as any)
        .from("lowest_prices_today")
        .select("id, store_name")
        .in("country_code", [...CATALOG_COUNTRIES])
        .in("currency", [...CATALOG_CURRENCIES])
        .not("image_url", "is", null)
        .neq("image_url", "")
        .in("provider", [...REAL_CATALOG_PROVIDERS])
        .order("id", { ascending: true })
        .limit(MERCHANT_SCAN_PAGE);
      if (cursor) query = query.gt("id", cursor);
      if (upper) query = query.lte("id", upper);
      const { data, error } = await query;
      if (!error) return (data ?? []) as ScanRow[];
    }
    return null;
  };

  const scanPartition = async (
    lower: string | null,
    upper: string | null,
  ): Promise<void> => {
    let cursor = lower;
    for (;;) {
      const rows = await fetchPage(cursor, upper);
      if (rows === null) return;
      for (const row of rows) {
        const name = row.store_name?.trim();
        if (name) names.add(name);
      }
      if (rows.length < MERCHANT_SCAN_PAGE) return;
      cursor = rows[rows.length - 1].id;
    }
  };

  // Random UUID boundaries partition the key space evenly across workers
  // (UUIDs are uniformly distributed), avoiding both deep offsets and a long
  // sequential walk.
  const boundaries = Array.from({ length: MERCHANT_SCAN_WORKERS }, () =>
    crypto.randomUUID(),
  ).sort();

  await Promise.all(
    boundaries.map((boundary, index) =>
      scanPartition(
        index === 0 ? null : boundary,
        index === boundaries.length - 1 ? null : boundaries[index + 1],
      ),
    ),
  );

  return Array.from(names);
}
/**
 * Read a merchant-breadth sample of the Supabase `lowest_prices_today` table.
 * Returns NormalizedCatalogItems that can be merged with live search results.
 *
 * Unlike a single discount-limited slice (which a single dominant merchant can
 * flood and thereby hide every other real store), this pulls a bounded number
 * of the top products FROM EACH real merchant. Every real store in the DB is
 * therefore represented in the homepage catalog â€” so the store count is real
 * and the rendered feed stays diverse. Gracefully returns [] when Supabase is
 * not configured.
 */
export async function getCatalogItemsFromDatabase(): Promise<NormalizedCatalogItem[]> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return [];

  const storeNames = await getRealMerchantNames(supabase);
  if (storeNames.length === 0) return [];

  const PER_MERCHANT = 40;
  const PER_MERCHANT_CONCURRENCY = 12;
  const collected: LowestPriceRow[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Fetch each merchant's breadth sample concurrently. Sequential per-merchant
  // queries pushed the whole DB leg past its homepage budget once the merchant
  // scan was fixed, so bound the fan-out instead.
  for (let i = 0; i < storeNames.length; i += PER_MERCHANT_CONCURRENCY) {
    const chunk = storeNames.slice(i, i + PER_MERCHANT_CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (storeName) => {
        const { data, error } = await sb
          .from("lowest_prices_today")
          .select(
            "id, product_id, product_name, product_slug, image_url, emoji, lowest_price, original_price, discount_percent, store_name, provider, affiliate_url, external_url, country_code, currency",
          )
          .in("country_code", [...CATALOG_COUNTRIES])
          .in("currency", [...CATALOG_CURRENCIES])
          .eq("store_name", storeName)
          // Only real, image-bearing products enter the homepage catalog. The DB is
          // ~92% image-covered (120K rows), but some store feeds stored empty image
          // URLs that would otherwise resolve to placeholder cards. Filtering here
          // surfaces real products with real images so valid URLs render.
          .not("image_url", "is", null)
          .neq("image_url", "")
          .order("discount_percent", { ascending: false })
          .order("lowest_price", { ascending: false })
          .limit(PER_MERCHANT);
        if (error || !data) return [] as LowestPriceRow[];
        return data as LowestPriceRow[];
      }),
    );

    for (const data of results) {
      for (const row of data) {
        if (
          row.product_name &&
          row.image_url &&
          // Reject rows whose image normalizes to the placeholder (empty,
          // http-only, or invalid URLs all land there) â€” never placeholder cards.
          normalizeProductImageUrl(row.image_url) !== PRODUCT_IMAGE_PLACEHOLDER
        ) {
          collected.push(row);
        }
      }
    }
  }

  // Dedupe on product_id so a product present across multiple merchants/rows
  // (rare) is not double-counted in the catalog feed.
  const byId = new Map<string, LowestPriceRow>();
  for (const row of collected) {
    if (!byId.has(row.product_id)) byId.set(row.product_id, row);
  }
  const rows = Array.from(byId.values());
  if (rows.length === 0) return [];

  // Batch-fetch category_slug from products table for these product IDs
  const productIds = rows.map((r) => r.product_id);
  const { data: productRows } = await sb
    .from("products")
    .select("id, category_slug")
    .in("id", productIds);

  const categoryMap = new Map<string, string | null>();
  for (const p of productRows ?? []) {
    categoryMap.set(p.id, p.category_slug);
  }

  return rows.map((row) => {
    row.category_slug = categoryMap.get(row.product_id) ?? null;
    return rowToCatalogItem(row);
  });
}

/**
 * Total count of real, image-bearing products in `lowest_prices_today` across
 * the live providers. This is the honest product-catalog size (not the bounded
 * in-memory feed), so the homepage "Products" stat reflects reality.
 *
 * Reliability:
 * - The count query MUST use the array-form `.in("provider", [...])` filter,
 *   NOT the string-form `.or("provider.in.(...)")`. Verified against the live
 *   120K-row table: `count: "exact"` combined with the `.or()` string form is
 *   planned as a PostgREST `or` filter and consistently 500s / times out
 *   (~4s statement cancellation), which is the root cause of the intermittent
 *   homepage "Products: 0". The array form is handled by the normal query
 *   planner path and returns the exact count in <1s.
 * - Retry transient failures; the caller caches the result for 5 minutes.
 * - Never surface "0" while real products exist: if the DB count is genuinely
 *   unavailable we fall back to the merged live catalog the homepage actually
 *   renders (a real, valid source), then to the last-known-good DB count.
 *   Returns 0 only when every real source is empty/unavailable.
 */
const COUNT_RETRIES = 3;
let lastKnownProductCount = 0;

/**
 * Test-only seams so regression tests can exercise the real retry/fallback
 * logic without a live Supabase connection (isolate:false + singleFork:true
 * makes per-module mocking unreliable). Production always passes null.
 */
let supabaseClientFactoryForTests: (() => SupabaseDb | null) | null = null;
let catalogFallbackCountForTests: (() => Promise<number>) | null = null;
let productCountWriterForTests: ((count: number) => Promise<void>) | null = null;
let productCountReaderForTests: (() => Promise<number>) | null = null;
let catalogCountReaderForTests: (() => Promise<number>) | null = null;
let catalogCountAgeReaderForTests: (() => Promise<number>) | null = null;
let catalogCountWriterForTests: ((count: number) => Promise<void>) | null = null;

/** Test-only: inject a fake `createSupabaseAnonClient` factory. */
export function setSupabaseAnonClientForTests(
  factory: (() => SupabaseDb | null) | null,
): void {
  supabaseClientFactoryForTests = factory;
}

/** Test-only: inject a fake merged-catalog fallback count source. */
export function setCatalogFallbackCountForTests(
  source: (() => Promise<number>) | null,
): void {
  catalogFallbackCountForTests = source;
}

/**
 * Test-only: inject fake last-known-good persistence read/write hooks so a
 * fresh-instance failure path can be exercised without a live service client.
 */
export function setProductCountPersistenceForTests(source: {
  writer?: ((count: number) => Promise<void>) | null;
  reader?: (() => Promise<number>) | null;
} | null): void {
  productCountWriterForTests = source?.writer ?? null;
  productCountReaderForTests = source?.reader ?? null;
}

/**
 * Test-only: inject fake `catalog_count` fast-path read/age/write hooks so the
 * fresh fast path and the stale/absent recompute branches can be exercised
 * without a live Supabase connection.
 */
export function setCatalogCountSourceForTests(source: {
  reader?: (() => Promise<number>) | null;
  ageReader?: (() => Promise<number>) | null;
  writer?: ((count: number) => Promise<void>) | null;
} | null): void {
  catalogCountReaderForTests = source?.reader ?? null;
  catalogCountAgeReaderForTests = source?.ageReader ?? null;
  catalogCountWriterForTests = source?.writer ?? null;
}

/** Test-only: restore all count seams and forget the known-good count. */
export function resetRealCatalogProductCountForTests(): void {
  supabaseClientFactoryForTests = null;
  catalogFallbackCountForTests = null;
  productCountWriterForTests = null;
  productCountReaderForTests = null;
  setCatalogCountSourceForTests(null);
  lastKnownProductCount = 0;
  lastPersistedProductCount = -1;
}

export async function getRealCatalogProductCount(): Promise<number> {
  // Fast path: a FRESH maintained `catalog_count` row is the authoritative
  // count without paying for the expensive exact-count over the 120K-row
  // table on the render hot path. Only when the row is absent or stale do we
  // fall through to the live count (seeded by the cron refresh off-path and
  // by any successful render).
  const freshMaintained = await readFreshMaintainedCatalogCount();
  if (freshMaintained > 0) {
    lastKnownProductCount = freshMaintained;
    return freshMaintained;
  }

  const supabase = supabaseClientFactoryForTests
    ? supabaseClientFactoryForTests()
    : createSupabaseAnonClient();
  if (!supabase) return fallbackRealCatalogProductCount();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  for (let attempt = 0; attempt < COUNT_RETRIES; attempt++) {
    const { count, error } = await sb
      .from("lowest_prices_today")
      .select("product_id", { count: "exact", head: true })
      .in("country_code", [...CATALOG_COUNTRIES])
      .in("currency", [...CATALOG_CURRENCIES])
      .in("provider", [...REAL_CATALOG_PROVIDERS]);

    if (!error && typeof count === "number") {
      lastKnownProductCount = count;
      // Fire-and-forget: persist the known-good count so a cold instance
      // (empty module memory) can restore it after a transient failure. Never
      // blocks or fails the stat path.
      void persistProductCount(count);
      void writeMaintainedCatalogCount(count);
      return count;
    }
  }

  return fallbackRealCatalogProductCount();
}

/**
 * Read the maintained `catalog_count` row only when it is FRESH (written within
 * CATALOG_COUNT_FRESHNESS_MS). Stale/absent rows return 0 so the caller
 * recomputes the live count. Single-row read â€” single-digit milliseconds.
 */
async function readFreshMaintainedCatalogCount(): Promise<number> {
  let ageMs: number;
  if (catalogCountAgeReaderForTests) {
    try {
      ageMs = await catalogCountAgeReaderForTests();
    } catch {
      ageMs = Number.POSITIVE_INFINITY;
    }
  } else {
    if (process.env.NODE_ENV === "test") return 0;
    ageMs = await getCatalogCountAgeMs();
  }
  if (!(ageMs < CATALOG_COUNT_FRESHNESS_MS)) return 0;

  let count: number;
  if (catalogCountReaderForTests) {
    try {
      count = await catalogCountReaderForTests();
    } catch {
      return 0;
    }
  } else {
    if (process.env.NODE_ENV === "test") return 0;
    count = await getCatalogCount();
  }
  return count > 0 ? count : 0;
}

/**
 * Best-effort write of a known-good count into the maintained `catalog_count`
 * row (service_role upsert). Never throws into the caller.
 */
async function writeMaintainedCatalogCount(count: number): Promise<void> {
  if (catalogCountWriterForTests) {
    try {
      await catalogCountWriterForTests(count);
    } catch {
      // best-effort â€” never let persistence break the stat
    }
    return;
  }

  // Never write through a real service client inside vitest (the suite runs
  // without an explicit writer seam); production always proceeds below.
  if (process.env.NODE_ENV === "test") return;

  try {
    await setCatalogCount(count);
  } catch {
    // best-effort â€” never let persistence break the stat
  }
}

/**
 * Preference order after the exact-count query fails on ALL retries.
 * Never report a transient failure as 0 while real products exist:
 * 1) This instance's last observed real DB count (in-memory).
 * 2) The last count maintained in `catalog_count` â€” a real DB value, even if
 *    stale â€” restores the truthful catalog size (e.g. 69K+) on a cold
 *    instance instead of the tiny merged-catalog sample (merged catalog only
 *    carries a bounded representative slice of the DB, ~18 items).
 * 3) The LAST REAL DB count persisted in `integration_settings`.
 * 4) The merged live catalog length the homepage actually renders.
 * Returns 0 only when every real source is genuinely empty/unavailable.
 */
async function fallbackRealCatalogProductCount(): Promise<number> {
  if (lastKnownProductCount > 0) return lastKnownProductCount;

  const maintainedCount = await readAnyMaintainedCatalogCount();
  if (maintainedCount > 0) {
    lastKnownProductCount = maintainedCount;
    return maintainedCount;
  }

  const persistedCount = await readPersistedProductCount();
  if (persistedCount > 0) {
    lastKnownProductCount = persistedCount;
    return persistedCount;
  }

  const catalogCount = await getCatalogFallbackCount();
  if (catalogCount > 0) return catalogCount;
  return lastKnownProductCount;
}

/** Read the maintained count regardless of age; 0 when absent/unreadable. */
async function readAnyMaintainedCatalogCount(): Promise<number> {
  if (catalogCountReaderForTests) {
    try {
      const count = await catalogCountReaderForTests();
      return count > 0 ? count : 0;
    } catch {
      return 0;
    }
  }
  if (process.env.NODE_ENV === "test") return 0;
  try {
    const count = await getCatalogCount();
    return count > 0 ? count : 0;
  } catch {
    return 0;
  }
}

/** integration_settings.key holding the last-known-good real catalog count. */
const PRODUCT_COUNT_SETTING_KEY = "homepage_product_count";
let lastPersistedProductCount = -1;

/**
 * Best-effort persist of the last-known-good real count into
 * `integration_settings` (service_role). Skipped when the count is unchanged
 * (the catalog count is stable between syncs), when no service client is
 * available, or inside tests without an explicit writer seam.
 */
async function persistProductCount(count: number): Promise<void> {
  if (count <= 0 || count === lastPersistedProductCount) return;

  if (productCountWriterForTests) {
    try {
      await productCountWriterForTests(count);
      lastPersistedProductCount = count;
    } catch {
      // best-effort â€” never let persistence break the stat
    }
    return;
  }

  // Never persist through a real service client inside vitest (the suite runs
  // without an explicit writer seam); production always proceeds below.
  if (process.env.NODE_ENV === "test") return;

  try {
    const supabase = createSupabaseServiceClient();
    if (!supabase) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { error } = await sb.from("integration_settings").upsert(
      {
        key: PRODUCT_COUNT_SETTING_KEY,
        value: String(count),
        provider: "system",
        label: "Homepage real product count",
        is_secret: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (!error) lastPersistedProductCount = count;
  } catch {
    // best-effort â€” never let persistence break the stat
  }
}

/** Read the persisted last-known-good count; 0 when absent/unreadable. */
async function readPersistedProductCount(): Promise<number> {
  try {
    if (productCountReaderForTests) {
      const value = await productCountReaderForTests();
      return value > 0 ? value : 0;
    }

    // Never read through a real service client inside vitest (the suite runs
    // without an explicit reader seam); production always proceeds below.
    if (process.env.NODE_ENV === "test") return 0;

    const supabase = createSupabaseServiceClient();
    if (!supabase) return 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data } = await sb
      .from("integration_settings")
      .select("value")
      .eq("key", PRODUCT_COUNT_SETTING_KEY)
      .maybeSingle();
    const raw = data as { value?: string | number } | null;
    const count = Number(raw?.value ?? 0);
    return Number.isFinite(count) && count > 0 ? count : 0;
  } catch {
    return 0;
  }
}

/**
 * Real fallback for the homepage "Products" stat when the DB count is
 * unavailable: the number of distinct real products in the merged live catalog
 * â€” the SAME source that renders the homepage cards. Dynamically imported to
 * avoid a static circular dependency with catalog-service. Returns 0 when the
 * catalog is also unavailable/empty (then the caller uses last-known-good).
 */
async function getCatalogFallbackCount(): Promise<number> {
  if (catalogFallbackCountForTests) {
    try {
      return await catalogFallbackCountForTests();
    } catch {
      return 0;
    }
  }
  try {
    const { getMergedCatalogItems } = await import(
      "@/lib/integration/catalog-service"
    );
    const items = await getMergedCatalogItems();
    return items.length;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Catalog viability gate & last-known-good
// ---------------------------------------------------------------------------

/**
 * Minimum viable catalog rule: a healthy merged catalog MUST span at least
 * two distinct real provider sources. The homepage is a multi-marketplace
 * surface by design (see the balancer rationale in homepage-sections.ts).
 * When provider latency collapses the fan-out to a single fast source, the
 * resulting pool is clearly incomplete and must NOT overwrite an existing
 * healthy snapshot in cache.
 *
 * - Deterministic (no randomness, no side effects)
 * - Provider-neutral (no specific provider named or required)
 * - Derived from the multi-marketplace identity of the architecture
 * - Small (>=2 is the smallest non-trivial multi-source threshold)
 * - Covered by regression tests
 */
export const MIN_VIABLE_SOURCES = 2;

export function isCatalogViable(items: NormalizedCatalogItem[]): boolean {
  if (items.length === 0) return false;
  const providers = new Set<string>();
  for (const item of items) {
    const pid = resolveMarketplaceId(
      item.providerIds[0] ?? item.offers[0]?.providerId ?? "unknown",
    );
    providers.add(pid);
  }
  return providers.size >= MIN_VIABLE_SOURCES;
}

/**
 * Last-known-good catalog snapshot (per-instance module memory, mirroring the
 * established `lastKnownProductCount` pattern). Once a healthy catalog has been
 * generated, subsequent degraded regenerations return this snapshot instead of
 * letting the unstable_cache slot be overwritten with incomplete data.
 *
 * The main `homepage:merged-catalog-v13-image-fix` unstable_cache slot persists
 * across requests on a warm instance. Module memory is set on the first viable
 * generation; all subsequent degraded regens within the same process lifetime
 * use the cached healthy snapshot. The residual cold-instance edge (module
 * memory empty on a brand-new worker with no prior healthy generation) falls
 * through to returning the degraded catalog -- this is acceptable because
 * unstable_cache always caches the return, and the degraded catalog is at least
 * a truthful representation when no healthy snapshot has ever been established.
 */
let lastKnownGoodCatalog: NormalizedCatalogItem[] = [];

/** Store a healthy catalog snapshot in module memory. */
export function rememberCatalogAsHealthy(items: NormalizedCatalogItem[]): void {
  lastKnownGoodCatalog = items;
}

/** Retrieve the last-known-good catalog snapshot (empty array if none yet). */
export function getLastKnownGoodCatalog(): NormalizedCatalogItem[] {
  return lastKnownGoodCatalog;
}

export interface CatalogSnapshotOutcome {
  items: NormalizedCatalogItem[];
  /** True when `items` is a trustworthy, full-TTL-worthy snapshot. */
  healthy: boolean;
}

/**
 * Resolve the final catalog snapshot from freshly-generated items and a
 * completeness signal.
 *
 * A snapshot is HEALTHY only when it is provider-viable AND `complete` (no
 * source was skipped for exceeding its budget). A viable-but-incomplete
 * snapshot (e.g. the fast providers returned while the DB/Admitad sources timed
 * out) is NOT healthy: the last-known-good snapshot is returned when one exists,
 * otherwise the truthful partial is returned but flagged unhealthy so callers
 * reuse it only briefly. Provider-neutral and deterministic.
 */
export function resolveCatalogSnapshot(
  freshItems: NormalizedCatalogItem[],
  complete = true,
): CatalogSnapshotOutcome {
  if (isCatalogViable(freshItems) && complete) {
    rememberCatalogAsHealthy(freshItems);
    return { items: freshItems, healthy: true };
  }
  // Degraded: protect the cache by returning the last-known-good snapshot.
  // Cold start: no known-good exists yet -> return fresh (truthful fallback).
  if (lastKnownGoodCatalog.length > 0) {
    return { items: lastKnownGoodCatalog, healthy: true };
  }
  return { items: freshItems, healthy: false };
}

/**
 * Pure function: resolve the final catalog items from the freshly-generated
 * items (completeness assumed). Thin wrapper over {@link resolveCatalogSnapshot}
 * retained for existing callers/tests.
 */
export function resolveCatalogOutcome(
  freshItems: NormalizedCatalogItem[],
): NormalizedCatalogItem[] {
  return resolveCatalogSnapshot(freshItems).items;
}

/**
 * Test-only seam: reset the viability gate state (known-good catalog memory).
 * Mirrors the resetRealCatalogProductCountForTests() pattern above.
 */
export function resetCatalogViabilityForTests(): void {
  lastKnownGoodCatalog = [];
}

function rowToSearchResultItem(row: LowestPriceRow): SearchResultItem {
  const providerId = resolveMarketplaceId(row.provider ?? row.store_name);
  const affiliateUrl = row.affiliate_url ?? row.external_url ?? "";
  const originalPrice = Number(row.original_price ?? row.lowest_price);
  const price = Number(row.lowest_price);
  const discount =
    originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0;

  const rawCategory = row.category_slug;
  const category =
    rawCategory && rawCategory !== "general"
      ? rawCategory
      : inferCategoryFromName(row.product_name);

  const item: SearchResultItem = {
    id: `db-${row.product_id}`,
    name: row.product_name,
    imageSrc: normalizeProductImageUrl(row.image_url),
    emoji: row.emoji ?? "ðŸ›ï¸",
    price,
    originalPrice,
    discount,
    store: row.store_name,
    storeSlug: providerId,
    rating: 0,
    reviewCount: 0,
    inStock: true,
    category,
    currency: row.currency,
    countryCode: row.country_code,
    affiliateUrl,
  };
  return { ...item, productCard: toProductCard(item) ?? undefined };
}

/**
 * Family-breadth DB supplement for the Device-intent Search fan-out.
 * Sibling of `getSearchResultsFromDatabase` (same real-merchant breadth pool,
 * same `rowToSearchResultItem` mapper, same hard-`.forEach` timeout seam, same
 * `SearchResultItem[]` contract) but WITHOUT the word-boundary `product_name`
 * gate - so the family leg surfaces the same genuine brand+codename inventory
 * the Categories/Hero catalog breadth already renders (e.g. "iPhone 15 Pro
 * Max" rows that `\biphone\b` on the concatenated brand+codename name could
 * never word-boundary match).
 *
 * On DB error or timeout it truthfully resolves to `[]` - the same "no
 * additional DB family products" state the caller would see - never
 * fabricated/partial rows.
 */
export async function getFamilyBreadthResultsFromDatabase(
  familyKeyword: string,
  limit: number,
  options?: { timeoutMs?: number },
): Promise<SearchResultItem[]> {
  const timeoutMs = options?.timeoutMs;
  if (!timeoutMs || timeoutMs <= 0)
    return loadSearchResultsFromDatabase(familyKeyword, limit);

  return new Promise<SearchResultItem[]>((resolve) => {
    const timer = setTimeout(() => resolve([]), timeoutMs);
    loadSearchResultsFromDatabase(familyKeyword, limit).then(
      (items) => {
        clearTimeout(timer);
        resolve(items);
      },
      () => {
        clearTimeout(timer);
        resolve([]);
      },
    );
  });
}

/**
 * Read products from Supabase matching a search query.
 * Returns SearchResultItems that can be merged with live search-engine results.
 *
 * The search fan-out passes a hard `timeoutMs` so a slow database read can
 * never hold the whole query hostage. On timeout the DB supplement resolves to
 * an EMPTY pool â€” the same *truthful* "no additional DB products" state the
 * caller already sees after a DB error â€” never fabricated/partial rows.
 */
export async function getSearchResultsFromDatabase(
  query: string,
  limit = 24,
  options?: { timeoutMs?: number; useFuzzyMatch?: boolean; originalQuery?: string },
): Promise<SearchResultItem[]> {
  const deadline = options?.timeoutMs;
  const useFuzzy = options?.useFuzzyMatch === true;
  const originalQuery = options?.originalQuery;
  if (!deadline || deadline <= 0) {
    return loadSearchResultsFromDatabase(query, limit, useFuzzy, originalQuery);
  }

  return new Promise<SearchResultItem[]>((resolve) => {
    const timer = setTimeout(() => resolve([]), deadline);
    loadSearchResultsFromDatabase(query, limit, useFuzzy, originalQuery).then(
      (items) => {
        clearTimeout(timer);
        resolve(items);
      },
      (_err) => {
        clearTimeout(timer);
        // A DB error is a truthful "no database products".
        resolve([]);
      },
    );
  });
}

/**
 * Fast, provider-scoped Supabase read for synced Jumia / Admitad rows. Uses
 * the same word-boundary filter and image guards as the regular DB supplement
 * but restricts to the given provider keys and a small limit, so it resolves
 * inside a strict 200ms budget even when every external scraper is slow.
 */
export async function getSyncedStoreResultsFromDatabase(
  providers: readonly string[],
  query: string,
  limit = 24,
  timeoutMs = 200,
  originalQuery?: string,
): Promise<SearchResultItem[]> {
  if (providers.length === 0) return [];

  const load = async (): Promise<SearchResultItem[]> => {
    const supabase = supabaseClientFactoryForTests
      ? supabaseClientFactoryForTests()
      : createSupabaseAnonClient();
    if (!supabase) return [];

    const groups = strictTitleTokenGroups(query, originalQuery);
    const orFilter = strictCandidateFilterForGroups(groups);
    const categoryIds = await categoryProductIdOrFilter(supabase, [query, originalQuery], limit);
    const combinedOrFilter = appendOrFilter(orFilter, categoryIds);
    if (!combinedOrFilter) return [];
    const strictIntent = analyzeStrictIntent(query, originalQuery);

    const { data, error } = await db(supabase)
      .from("lowest_prices_today")
      .select(
        "id, product_id, product_name, product_slug, image_url, emoji, lowest_price, original_price, discount_percent, store_name, provider, affiliate_url, external_url, country_code, currency",
      )
      .in("provider", [...providers])
      .or(combinedOrFilter)
      .in("country_code", [...CATALOG_COUNTRIES])
      .not("image_url", "is", null)
      .neq("image_url", "")
      .limit(Math.max(1, Math.min(limit, 60)));

    if (error || !data?.length) return [];

    const usableRows = (data as LowestPriceRow[]).filter(
      (row) =>
        row.product_name &&
        row.image_url &&
        normalizeProductImageUrl(row.image_url) !== PRODUCT_IMAGE_PLACEHOLDER &&
        passesStrictTitle(row.product_name, strictIntent),
    );
    const rows = selectStrictTierRows(usableRows, groups);
    return rows.map((row) => rowToSearchResultItem(row)).slice(0, limit);
  };

  return new Promise<SearchResultItem[]>((resolve) => {
    const timer = setTimeout(() => resolve([]), Math.max(1, timeoutMs));
    load().then(
      (items) => {
        clearTimeout(timer);
        resolve(items);
      },
      () => {
        clearTimeout(timer);
        resolve([]);
      },
    );
  });
}

async function discoverSearchStoreNames(
  supabase: SupabaseDb,
): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  if (typeof client.rpc !== "function") return [];
  return getRealMerchantNames(supabase).catch(() => []);
}

async function loadSingleStorePool(
  supabase: SupabaseDb,
  combinedOrFilter: string,
  limit: number,
): Promise<LowestPriceRow[]> {
  const { data, error } = await db(supabase)
    .from("lowest_prices_today")
    .select(STRICT_SEARCH_ROW_COLUMNS)
    .or(combinedOrFilter)
    .in("country_code", [...CATALOG_COUNTRIES])
    .in("currency", currencyCodes)
    .not("image_url", "is", null)
    .neq("image_url", "")
    .order("discount_percent", { ascending: false })
    .order("product_name", { ascending: true })
    .order("id", { ascending: true })
    .limit(Math.max(limit * 2, 1));
  if (error || !data?.length) return [];
  return data as LowestPriceRow[];
}

async function loadPerStorePools(
  supabase: SupabaseDb,
  combinedOrFilter: string,
  limit: number,
): Promise<{ rows: LowestPriceRow[]; perStore: boolean }> {
  const storeNames = await discoverSearchStoreNames(supabase);
  if (storeNames.length === 0) {
    return { rows: await loadSingleStorePool(supabase, combinedOrFilter, limit), perStore: false };
  }

  const perStoreLimit = Math.max(
    8,
    Math.min(60, Math.ceil(limit / storeNames.length) * 4),
  );
  const rows: LowestPriceRow[] = [];
  const concurrency = 10;
  for (let index = 0; index < storeNames.length; index += concurrency) {
    const batch = storeNames.slice(index, index + concurrency);
    const batches = await Promise.all(
      batch.map(async (storeName) => {
        const { data, error } = await db(supabase)
          .from("lowest_prices_today")
          .select(STRICT_SEARCH_ROW_COLUMNS)
          .eq("store_name", storeName)
          .or(combinedOrFilter)
          .in("country_code", [...CATALOG_COUNTRIES])
          .in("currency", currencyCodes)
          .not("image_url", "is", null)
          .neq("image_url", "")
          .order("discount_percent", { ascending: false })
          .order("product_name", { ascending: true })
          .order("id", { ascending: true })
          .limit(perStoreLimit);
        if (error || !data?.length) return [] as LowestPriceRow[];
        return data as LowestPriceRow[];
      }),
    );
    for (const batchRows of batches) rows.push(...batchRows);
  }

  if (rows.length === 0) {
    return { rows: await loadSingleStorePool(supabase, combinedOrFilter, limit), perStore: false };
  }
  return { rows, perStore: true };
}

async function loadSearchResultsFromDatabase(
  query: string,
  limit: number,
  useFuzzyMatch = false,
  originalQuery?: string,
): Promise<SearchResultItem[]> {
  const supabase = supabaseClientFactoryForTests
    ? supabaseClientFactoryForTests()
    : createSupabaseAnonClient();
  if (!supabase) return [];

  // Canonical-token OR matching: "nike shoes" â†’ product_name ~* '\m(nike)\M' OR
  // '\m(shoes)\M' over NORMALIZED tokens â€” noise-stripped ("new", "original",
  // "free shipping", "Ù„Ù„Ø¨ÙŠØ¹"), Arabic-orthography-folded ("Ø¢ÙŠÙÙˆÙ†" â†’ Ø§ÙŠÙÙˆÙ† â†’
  // matches Ø¢ÙŠÙÙˆÙ†/Ø£ÙŠÙÙˆÙ†/Ø¥ÙŠÙÙˆÙ† rows), English plural-expanded ("case" â†’ cases).
  // Word-boundary regex (not ILIKE '%w%') stops short tokens from matching
  // inside unrelated words ("pro" âŠ‚ "waterproof"/"professional"; "15" âŠ‚
  // "x15-box"), which previously flooded the pool with irrelevant rows.
  // Word overlap scoring happens post-query.
  // When useFuzzyMatch is true (for Arabic-translated queries), use ILIKE
  // substring matching for maximum recall.
  const strictIntent = analyzeStrictIntent(query, originalQuery);
  const groups = strictTitleTokenGroups(query, originalQuery);
  const orFilter = strictCandidateFilterForGroups(groups);
  const categoryIds = await categoryProductIdOrFilter(supabase, [query, originalQuery], limit);
  const combinedOrFilter = appendOrFilter(orFilter, categoryIds);

  if (!combinedOrFilter) return [];

  const { rows: candidateRows, perStore } = await loadPerStorePools(
    supabase,
    combinedOrFilter,
    limit,
  );
  if (candidateRows.length === 0) return [];

  const seenProductIds = new Set<string>();
  const usableRows = candidateRows.filter((row) => {
    if (!row.product_name || !row.image_url) return false;
    if (normalizeProductImageUrl(row.image_url) === PRODUCT_IMAGE_PLACEHOLDER) return false;
    if (seenProductIds.has(row.product_id)) return false;
    seenProductIds.add(row.product_id);
    return passesStrictTitle(row.product_name, strictIntent);
  });
  const rows = selectStrictTierRows(usableRows, groups);
  if (rows.length === 0) return [];

  const productIds = rows.map((r) => r.product_id);
  const { data: productRows } = await db(supabase)
    .from("products")
    .select("id, category_slug")
    .in("id", productIds);

  const categoryMap = new Map<string, string | null>();
  for (const p of productRows ?? []) {
    categoryMap.set(p.id, p.category_slug);
  }

  const results = rows.map((row) => {
    row.category_slug = categoryMap.get(row.product_id) ?? null;
    return rowToSearchResultItem(row);
  });

  sortByCombinedRelevance(results, query, originalQuery);

  const balanced = perStore
    ? balanceFlatMarketplaceList(
        results,
        storeKeyForResult,
        results.length,
        (a, b) => b.discount - a.discount || a.price - b.price,
        1,
      )
    : results;

  return balanced.slice(0, limit);
}

/**
 * Deep window the DEVICE-intent DB tail legs walk. It is read in paged chunks

 * under the Supabase 1000-row fetch cap, then the SQL-guard-prefiltered rows are
 * re-checked with the in-memory strict device guard + relevance ranking in JS,
 * so pages past the pool slice a genuine device sequence instead of a
 * discount-ordered window that is often saturated with accessories.
 */
export const DEVICE_TAIL_DEEP_WINDOW = 2000;
const DEVICE_TAIL_READ_PAGE = 900;

type DeviceTailRangeSource = {
  range: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>;
};

async function loadDeviceTailRows(
  source: DeviceTailRangeSource,
): Promise<LowestPriceRow[]> {
  const rows: LowestPriceRow[] = [];
  for (let from = 0; from < DEVICE_TAIL_DEEP_WINDOW; from += DEVICE_TAIL_READ_PAGE) {
    const to = Math.min(from + DEVICE_TAIL_READ_PAGE, DEVICE_TAIL_DEEP_WINDOW) - 1;
    const { data, error } = await source.range(from, to);
    if (error) return [];
    const page = Array.isArray(data) ? (data as LowestPriceRow[]) : [];
    rows.push(...page);
    if (page.length < to - from + 1) break;
  }
  return rows;
}

/** Device-intent DB leg options. `query` may differ from the surface query. */
export type DeviceDbLegOptions = {
  query: string;
  activeCurrency?: CurrencyCode;
  originalQuery?: string;
};

const DEVICE_SEARCH_COUNT_CACHE_TTL_MS = 5 * 60_000;
const DEVICE_SEARCH_COUNT_CACHE_MAX_ENTRIES = 50;
const deviceSearchCountCache = new Map<string, { count: number; expiresAt: number }>();

function setDeviceSearchCountCache(
  key: string,
  value: { count: number; expiresAt: number },
): void {
  setBoundedCacheEntry(
    deviceSearchCountCache,
    key,
    value,
    DEVICE_SEARCH_COUNT_CACHE_MAX_ENTRIES,
  );
}

/** Test hook â€” clears the device-count cache between tests. */
export function resetDeviceSearchCountCacheForTests(): void {
  deviceSearchCountCache.clear();
}

/**
 * SQL pre-filters that mirror the strict device guard ONCE at the index, so the
 * deep window a device tail leg fetches is not exhausted by accessory rows.
 * Base accessory terms always apply; handset queries add earphone/headphone and
 * the ABSOLUTE USD price floor. DB rows are stored in the US market catalog and
 * are overwhelmingly USD, but any SUPPORTED convertible currency may reach this
 * leg (search legs accept `currencyCodes`); the numeric floor below is only a
 * coarse index pre-filter â€” the in-memory `passesStrictDeviceGuard` re-checks
 * every row with its REAL currency so an EUR/AED row is never judged against a
 * raw USD baseline. A query that pins a concrete brand gets a must-contain OR
 * filter (Latin tokens) matching `titleMeetsRequiredBrand`.
 */
function deviceGuardSqlQueryContext(device: DeviceDbLegOptions): {
  excludeImatch: Array<{ regex: RegExp }>;
  brandOr: string | null;
  floor: number | null;
} {
  const handset = isHandsetQuery(device.query);
  const excludeImatch: Array<{ regex: RegExp }> = [{ regex: ACCESSORY_TERM_RE }];
  if (handset) excludeImatch.push({ regex: HANDSET_EXTRA_TERM_RE });

  const req = requiredBrandTokensForQuery(device.query);
  const brandOr = req?.tokens.length
    ? req.tokens
        .map((token) => `product_name.imatch.\\m${escapeRegexToken(token)}\\M`)
        .join(",")
    : null;

  return {
    excludeImatch,
    brandOr,
    floor: handset ? HANDSET_PRICE_FLOOR_USD : null,
  };
}

/**
 * DEVICE-intent exact count: the number of rows that survive the SQL guard
 * pre-filter AND the in-memory strict device guard inside the first
 * `DEVICE_TAIL_DEEP_WINDOW` rows â€” the SAME universe the device paged leg
 * serves, so in-window `total` and the beyond-pool leg agree and `hasMore`
 * renders the next genuine-device pages instead of mysteriously emptying.
 *
 * Successful (>0) counts are cached TTL 5 min so the 8s count race can never
 * flap `total` between a real match count and the pool length. A 0 (timeout /
 * empty / error) result is never cached â€” a transient dead datastore must
 * recover on the next request.
 */
async function loadDeviceSearchCountFromDatabase(
  device: DeviceDbLegOptions,
): Promise<number> {
  const cacheKey = `device:${getSearchCacheVersion()}:${device.query.trim().toLowerCase()}:orig:${(device.originalQuery ?? "").trim().toLowerCase()}`;
  const cached = deviceSearchCountCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.count;

  const supabase = supabaseClientFactoryForTests
    ? supabaseClientFactoryForTests()
    : createSupabaseAnonClient();
  if (!supabase) return 0;

  const words = combinedSearchTokens(device.query, device.originalQuery);
  if (words.length === 0) return 0;

  const orFilter = buildCombinedSearchOrFilter(device.query, device.originalQuery);
  const categoryIds = await categoryProductIdOrFilter(
    supabase,
    [device.query, device.originalQuery],
    60,
  );
  const combinedOrFilter = appendOrFilter(orFilter, categoryIds);
  const ctx = deviceGuardSqlQueryContext(device);

  const selected = db(supabase)
    .from("lowest_prices_today")
    .select(
      "id, product_id, product_name, product_slug, image_url, emoji, lowest_price, original_price, discount_percent, store_name, provider, affiliate_url, external_url, country_code, currency",
    )
    .or(combinedOrFilter)
    .in("country_code", [...CATALOG_COUNTRIES])
    .in("currency", currencyCodes)
    .not("image_url", "is", null)
    .neq("image_url", "");
  for (const { regex } of ctx.excludeImatch) {
    selected.not("product_name", "imatch", regex.source);
  }
  if (ctx.brandOr) selected.or(ctx.brandOr);
  if (ctx.floor !== null) selected.gte("lowest_price", ctx.floor);

  const ordered = selected
    .order("discount_percent", { ascending: false })
    .order("product_name", { ascending: true })
    .order("id", { ascending: true });
  const rows = await loadDeviceTailRows(ordered);

  if (rows.length === 0) return 0;

  const activeCurrency: CurrencyCode = device.activeCurrency ?? "USD";
  const matchingRows = rows.filter(
    (row) =>
      row.product_name &&
      row.image_url &&
      normalizeProductImageUrl(row.image_url) !== PRODUCT_IMAGE_PLACEHOLDER &&
      passesStrictDeviceGuard(
        row.product_name,
        Number(row.lowest_price),
        device.query,
        row.currency,
        activeCurrency,
      ),
  );
  const count = matchingRows.length;

  if (count > 0) {
    setDeviceSearchCountCache(cacheKey, {
      count,
      expiresAt: Date.now() + DEVICE_SEARCH_COUNT_CACHE_TTL_MS,
    });
  }
  return count;
}

/**
 * Exact match count for a search query against `lowest_prices_today`, using the
 * SAME word-boundary OR filter + US/USD + image filters as
 * `getSearchResultsFromDatabase` so `total`/`hasMore` on the pager reflect the
 * complete matching catalog (120K+ rows), not the 200-item display pool.
 *
 * `options?.device` switches the count to the device-intent universe: the SQL
 * guard pre-filter + in-memory strict device guard over the deep window, so a
 * handset query reports a truthful handset-reachable total instead of the raw
 * 120K accessory-inclusive match count.
 *
 * `options?.timeoutMs` mirrors the early-resolve-empty seam of
 * `getSearchResultsFromDatabase`: a slow/failed count resolves 0 so the pager
 * falls back to the pool length instead of hanging the "load more" call.
 */
export async function countSearchResultsFromDatabase(
  query: string,
  options?: {
    timeoutMs?: number;
    device?: DeviceDbLegOptions;
    originalQuery?: string;
  },
): Promise<number> {
  if (options?.device) {
    const device = options.device;
    const deadline = options.timeoutMs;
    if (!deadline || deadline <= 0) {
      return loadDeviceSearchCountFromDatabase(device);
    }
    return new Promise<number>((resolve) => {
      const timer = setTimeout(() => resolve(0), deadline);
      loadDeviceSearchCountFromDatabase(device).then(
        (count) => {
          clearTimeout(timer);
          resolve(count);
        },
        () => {
          clearTimeout(timer);
          resolve(0);
        },
      );
    });
  }

  const deadline = options?.timeoutMs;
  const originalQuery = options?.originalQuery;
  if (!deadline || deadline <= 0) {
    return loadSearchResultsCountFromDatabase(query, originalQuery);
  }

  return new Promise<number>((resolve) => {
    const timer = setTimeout(() => resolve(0), deadline);
    loadSearchResultsCountFromDatabase(query, originalQuery).then(
      (count) => {
        clearTimeout(timer);
        resolve(count);
      },
      () => {
        clearTimeout(timer);
        resolve(0);
      },
    );
  });
}

async function loadSearchResultsCountFromDatabase(
  query: string,
  originalQuery?: string,
): Promise<number> {
  const supabase = supabaseClientFactoryForTests
    ? supabaseClientFactoryForTests()
    : createSupabaseAnonClient();
  if (!supabase) return 0;

  const words = combinedSearchTokens(query, originalQuery);
  if (words.length === 0) return 0;

  const orFilter = buildCombinedSearchOrFilter(query, originalQuery);
  const categoryIds = await categoryProductIdOrFilter(supabase, [query, originalQuery], 60);
  const combinedOrFilter = appendOrFilter(orFilter, categoryIds);

  const { count, error } = await db(supabase)
    .from("lowest_prices_today")
    .select("product_id", { count: "exact", head: true })
    .or(combinedOrFilter)
    .in("country_code", [...CATALOG_COUNTRIES])
    .in("currency", currencyCodes)
    .not("image_url", "is", null)
    .neq("image_url", "");

  if (error || typeof count !== "number") return 0;
  return count;
}

/**
 * DB-index-level paged leg over the complete matching catalog. Same
 * word-boundary OR filter + US/USD + image filters and the same
 * `rowToSearchResultItem` mapping/ranking as `loadSearchResultsFromDatabase`,
 * but paginated with `.range(offset, offset + limit - 1)` (not `.limit(limit*2)`)
 * and a deterministic ORDER (discount desc + product_name/id tiebreaks) so page
 * boundaries can never have duplicates or gaps. `total` is the exact count of
 * all matching rows (PostgREST count over the filtered set, before the range),
 * so a beyond-window page carries the same truthful count as
 * `countSearchResultsFromDatabase`.
 *
 * `options?.excludeProductIds` removes those `product_id`s FROM THE UNIVERSE
 * *by set* (`product_id not in (...)`), shrinking the indexed space the
 * `offset`/`limit` window walks. The Search pager uses this to continue the
 * unified universe after the balanced pool: every db row the pool already
 * emitted is excluded here, so a window offset can never re-serve a row an
 * earlier page already showed, no matter where that row sits in discount order.
 *
 * `options?.timeoutMs` resolves `{ items: [], total: 0 }` on timeout â€” the same
 * truthful "no additional DB products" state as a DB error.
 */
export async function getSearchResultsFromDatabasePaged(
  query: string,
  offset: number,
  limit: number,
  options?: {
    timeoutMs?: number;
    excludeProductIds?: readonly string[];
    device?: DeviceDbLegOptions;
    originalQuery?: string;
  },
): Promise<{ items: SearchResultItem[]; total: number }> {
  const deadline = options?.timeoutMs;
  if (!deadline || deadline <= 0) {
    return loadSearchResultsFromDatabasePaged(
      query,
      offset,
      limit,
      options?.excludeProductIds,
      options?.device,
      options?.originalQuery,
    );
  }

  return new Promise<{ items: SearchResultItem[]; total: number }>((resolve) => {
    const timer = setTimeout(() => resolve({ items: [], total: 0 }), deadline);
    loadSearchResultsFromDatabasePaged(
      query,
      offset,
      limit,
      options?.excludeProductIds,
      options?.device,
      options?.originalQuery,
    ).then(
      (page) => {
        clearTimeout(timer);
        resolve(page);
      },
      () => {
        clearTimeout(timer);
        resolve({ items: [], total: 0 });
      },
    );
  });
}

async function loadSearchResultsFromDatabasePaged(
  query: string,
  offset: number,
  limit: number,
  excludeProductIds?: readonly string[],
  device?: DeviceDbLegOptions,
  originalQuery?: string,
): Promise<{ items: SearchResultItem[]; total: number }> {
  const supabase = supabaseClientFactoryForTests
    ? supabaseClientFactoryForTests()
    : createSupabaseAnonClient();
  if (!supabase) return { items: [], total: 0 };

  const words = combinedSearchTokens(query, originalQuery, device?.originalQuery);
  if (words.length === 0) return { items: [], total: 0 };
  const strictIntent = analyzeStrictIntent(query, originalQuery ?? device?.originalQuery);
  const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 1;

  const orFilter = buildCombinedSearchOrFilter(query, originalQuery, device?.originalQuery);
  const categoryIds = await categoryProductIdOrFilter(
    supabase,
    [query, originalQuery, device?.originalQuery],
    safeLimit,
  );
  const combinedOrFilter = appendOrFilter(orFilter, categoryIds);

  // Exclusion set carries real `product_id` values; the `not in (...)` list must
  // never be able to smuggle raw filter syntax, so only values without
  // PostgREST list/paren delimiters pass through.
  const exclusion = Array.isArray(excludeProductIds)
    ? excludeProductIds.filter(
        (id) => typeof id === "string" && id.length > 0 && !/[(),]/.test(id),
      )
    : [];

  const deviceContext = device ? deviceGuardSqlQueryContext(device) : null;

  const selected = db(supabase)
    .from("lowest_prices_today")
    .select(
      "id, product_id, product_name, product_slug, image_url, emoji, lowest_price, original_price, discount_percent, store_name, provider, affiliate_url, external_url, country_code, currency",
      // Device legs rank + filter after the deep fetch, so they never ask
      // PostgREST for an exact head count.
      deviceContext ? undefined : { count: "exact" },
    )
    .or(combinedOrFilter)
    .in("country_code", [...CATALOG_COUNTRIES])
    .in("currency", currencyCodes)
    .not("image_url", "is", null)
    .neq("image_url", "");

  if (deviceContext) {
    for (const { regex } of deviceContext.excludeImatch) {
      selected.not("product_name", "imatch", regex.source);
    }
    if (deviceContext.brandOr) selected.or(deviceContext.brandOr);
    if (deviceContext.floor !== null) {
      selected.gte("lowest_price", deviceContext.floor);
    }
  }

  if (exclusion.length > 0) {
    selected.not("product_id", "in", `(${exclusion.join(",")})`);
  }

  const ordered = selected
    // Deterministic catalog order: deepest discount first, then a stable
    // tiebreak so every page boundary resolves to the same rows.
    .order("discount_percent", { ascending: false })
    .order("product_name", { ascending: true })
    .order("id", { ascending: true });

  // DEVICE leg: fetch the deep window (kept well under Supabase's 1000-row
  // cap), re-apply the strict device guard in JS so accessory/junk rows the
  // SQL pre-filter cannot catch (Arabic terms, exotic word forms) can never
  // enter a page, rank by query-word overlap, then slice at the offset.
  // `total` is the length of that guard-passing sequence â€” the SAME count the
  // device count leg reports â€” so pages past the pool render the next batch of
  // genuine devices with a truthful `hasMore` instead of emptying.
  if (deviceContext) {
    const deepData = await loadDeviceTailRows(ordered);
    if (deepData.length === 0) return { items: [], total: 0 };

    const activeCurrency: CurrencyCode = device?.activeCurrency ?? "USD";
    const guardRows = deepData.filter(
      (row) =>
        row.product_name &&
        row.image_url &&
        normalizeProductImageUrl(row.image_url) !== PRODUCT_IMAGE_PLACEHOLDER &&
        passesStrictTitle(row.product_name, strictIntent) &&
        passesStrictDeviceGuard(
          row.product_name,
          Number(row.lowest_price),
          device!.query,
          row.currency,
          activeCurrency,
        ),
    );

    const productIds = guardRows.map((r) => r.product_id);
    const { data: productRows } = await db(supabase)
      .from("products")
      .select("id, category_slug")
      .in("id", productIds);

    const categoryMap = new Map<string, string | null>();
    for (const p of productRows ?? []) {
      categoryMap.set(p.id, p.category_slug);
    }

    const results = guardRows.map((row) => {
      row.category_slug = categoryMap.get(row.product_id) ?? null;
      return rowToSearchResultItem(row);
    });

    // Same word-overlap relevance ranking as the legacy supplement leg, applied
    // across the WHOLE deep window so the device sequence is relevance-ordered.
    sortByCombinedRelevance(results, query, originalQuery ?? device?.originalQuery);

    const start = Math.min(results.length, safeOffset);
    return {
      items: results.slice(start, start + safeLimit),
      total: results.length,
    };
  }

  const { data, count, error } = await ordered.range(
    safeOffset,
    safeOffset + safeLimit - 1,
  );

  const total = typeof count === "number" ? count : 0;
  if (error || !data?.length) return { items: [], total };

  const rows = (data as LowestPriceRow[]).filter(
    (row) =>
      row.product_name &&
      row.image_url &&
      normalizeProductImageUrl(row.image_url) !== PRODUCT_IMAGE_PLACEHOLDER &&
      passesStrictTitle(row.product_name, strictIntent),
  );

  const productIds = rows.map((r) => r.product_id);
  const { data: productRows } = await db(supabase)
    .from("products")
    .select("id, category_slug")
    .in("id", productIds);

  const categoryMap = new Map<string, string | null>();
  for (const p of productRows ?? []) {
    categoryMap.set(p.id, p.category_slug);
  }

  const results = rows.map((row) => {
    row.category_slug = categoryMap.get(row.product_id) ?? null;
    return rowToSearchResultItem(row);
  });

  // Same word-overlap relevance ranking as the legacy supplement leg, applied
  // within the deterministic page window.
  sortByCombinedRelevance(results, query, originalQuery ?? device?.originalQuery);

  return { items: results.slice(0, safeLimit), total };
}

/**
 * Read the Admitad `product_slug` (`admitad-<campaignId>-<offerId>`) for a
 * `lowest_prices_today` product_id. Used by the PDP resolver to match a DB row
 * to its live-feed offer so the real deep product/affiliate URL can be resolved
 * even when the persisted row stored only a merchant homepage URL.
 */
export async function getDatabaseProductSlug(
  productId: string,
): Promise<string | null> {
  const trimmed = productId.trim();
  if (!trimmed) return null;

  const supabase = createSupabaseAnonClient();
  if (!supabase) return null;

  const { data, error } = await db(supabase)
    .from("lowest_prices_today")
    .select("product_slug")
    .eq("product_id", trimmed)
    .limit(1);

  if (error) return null;
  const row = (data as { product_slug?: string | null }[] | null)?.[0];
  return row?.product_slug?.trim() || null;
}

/**
 * Read a single lowest_prices_today row by its product_id (the id embedded in
 * `db-<product_id>` catalog ids) and map it to a SearchResultItem.
 * Used by the marketplace PDP resolver for Admitad/DB-sourced products.
 */
export async function getDatabaseSearchItemByProductId(
  productId: string,
): Promise<SearchResultItem | null> {
  const trimmed = productId.trim();
  if (!trimmed) return null;

  const supabase = createSupabaseAnonClient();
  if (!supabase) return null;

  const { data, error } = await db(supabase)
    .from("lowest_prices_today")
    .select(
      "id, product_id, product_name, product_slug, image_url, emoji, lowest_price, original_price, discount_percent, store_name, provider, affiliate_url, external_url, country_code, currency",
    )
    .eq("product_id", trimmed)
    .limit(1);

  const row = (data as LowestPriceRow[] | null)?.[0];
  if (
    error ||
    !row ||
    !row.product_name ||
    !row.image_url ||
    normalizeProductImageUrl(row.image_url) === PRODUCT_IMAGE_PLACEHOLDER
  ) {
    return null;
  }

  const { data: productRows } = await db(supabase)
    .from("products")
    .select("id, category_slug")
    .eq("id", row.product_id)
    .limit(1);

  row.category_slug = productRows?.[0]?.category_slug ?? null;
  return rowToSearchResultItem(row);
}

/**
 * Look up a single lowest_prices_today row by its Admitad product_slug
 * (`admitad-<campaignId>-<offerId>`) and map it to a SearchResultItem.
 * This is the persisted-row counterpart of the live `admitad-â€¦` feed products,
 * used as a fallback by the PDP resolver when the live feed cache is cold.
 * Only real rows (real name + real image) are ever returned.
 */
export async function getDatabaseSearchItemByProductSlug(
  productSlug: string,
): Promise<SearchResultItem | null> {
  const trimmed = productSlug.trim();
  if (!trimmed) return null;

  const supabase = createSupabaseAnonClient();
  if (!supabase) return null;

  const { data, error } = await db(supabase)
    .from("lowest_prices_today")
    .select(
      "id, product_id, product_name, product_slug, image_url, emoji, lowest_price, original_price, discount_percent, store_name, provider, affiliate_url, external_url, country_code, currency",
    )
    .eq("product_slug", trimmed)
    .limit(1);

  const row = (data as LowestPriceRow[] | null)?.[0];
  if (
    error ||
    !row ||
    !row.product_name ||
    !row.image_url ||
    normalizeProductImageUrl(row.image_url) === PRODUCT_IMAGE_PLACEHOLDER
  ) {
    return null;
  }

  const { data: productRows } = await db(supabase)
    .from("products")
    .select("id, category_slug")
    .eq("id", row.product_id)
    .limit(1);

  row.category_slug = productRows?.[0]?.category_slug ?? null;
  return rowToSearchResultItem(row);
}
