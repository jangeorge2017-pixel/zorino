import { unstable_cache } from "next/cache";
import { cache as reactCache } from "react";
import type { HomepageSectionProducts } from "@/lib/data/homepage";
import { fetchMergedCatalog } from "@/lib/integration/comparison-engine";
import { HOMEPAGE_LIVE_FETCH_ENABLED } from "@/lib/integration/homepage-fetch-profile";
import {
  catalogItemToDeal,
  catalogItemToTrendingDealCard,
} from "@/lib/integration/normalize";
import type { NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import {
  balanceCatalogItems,
  balanceCards,
  buildHomepageSections,
  cardIdentityKeys,
  emptySectionProducts,
  minutesSinceFetched,
} from "@/lib/integration/homepage-sections";
import { PRODUCT_IMAGE_PLACEHOLDER } from "@/lib/images/product-image";
import { balanceFlatMarketplaceList } from "@/lib/search/marketplace-balance";
import { resolveMarketplaceId } from "@/lib/search/resolve-marketplace-id";
import { STUB_PROVIDER_IDS } from "@/lib/providers/registry";
import type { Deal, TrendingDealCard } from "@/lib/types/entities";

/**
 * Providers that have NO real production data source (no credentials, no live
 * connector). Their rows would otherwise leak placeholder bogus products into
 * the homepage through the DB catalog path. Derived from the canonical
 * provider registry (status === "stub") so the set cannot drift.
 */
const STUB_CATALOG_PROVIDERS = new Set(STUB_PROVIDER_IDS);

/** How long a merged live-catalog snapshot stays fresh (seconds). */
const CATALOG_REVALIDATE_SECONDS = 5 * 60;

/**
 * Hard budget for the direct Admitad feed fetch on the homepage catalog path.
 * The feed can legitimately take ~25s on a cold cache; bounding it here keeps
 * the initial homepage response fast (the feed drops out gracefully and the
 * catalog resolves from the search fan-out + persisted DB Admitad rows).
 */
const ADMITAD_FEED_CATALOG_BUDGET_MS = 5_000;

/**
 * Hard budget for the persisted DB catalog path (lowest_prices_today + merchant
 * queries). On a cold cache this can take 15–25s due to a paginated scan of
 * 120K rows plus per-merchant queries — more than the search fan-out. Bounding
 * it keeps the total catalog Promise.all wall-time short and ensures a slow DB
 * never prevents the faster live-search source from rendering usable data.
 */
const DB_CATALOG_BUDGET_MS = 10_000;

/** Normalise a product title for deduplication across live search and database. */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 5)
    .join(" ")
    .trim();
}

function isDuplicate(a: NormalizedCatalogItem, b: NormalizedCatalogItem): boolean {
  const na = normalizeTitle(a.title);
  const nb = normalizeTitle(b.title);
  if (!na || !nb) return false;
  return na === nb;
}

const loadMergedCatalogItems = unstable_cache(
  async (): Promise<NormalizedCatalogItem[]> => {
    try {
      const { fetchCatalogFromSearchEngine } = await import(
        "@/lib/integration/search-catalog"
      );
      const { getCatalogItemsFromDatabase } = await import(
        "@/lib/integration/database-catalog"
      );
      const { getIngestedCatalogItems } = await import(
        "@/lib/integration/affiliate-ingestion"
      );

      const [fromSearch, fromDb, fromIngestion, admitadFeeds] = await Promise.all([
        fetchCatalogFromSearchEngine().catch(() => [] as NormalizedCatalogItem[]),
        // The DB catalog scans ~120K rows + per-merchant queries; on a cold cache
        // this can take 15–25 s. Bounding it to DB_CATALOG_BUDGET_MS ensures a
        // slow DB never prevents the faster live-search source from rendering
        // usable data — any products collected before the budget expires are kept.
        Promise.race([
          getCatalogItemsFromDatabase(),
          new Promise<NormalizedCatalogItem[]>((resolve) =>
            setTimeout(() => resolve([]), DB_CATALOG_BUDGET_MS),
          ),
        ]).catch(() => [] as NormalizedCatalogItem[]),
        getIngestedCatalogItems().catch(() => [] as NormalizedCatalogItem[]),
        // Pre-warm Admitad feed cache so the search connector activates. This
        // must NEVER hold the homepage hostage: the direct feed fetch is raced
        // against a short budget so a cold/slow Admitad feed (~25s) cannot block
        // the initial catalog response. Admitad products remain present via the
        // search fan-out's Admitad connector and the persisted DB catalog.
        Promise.race([
          import("@/lib/integrations/admitad/feed-fetcher").then((m) => m.fetchAdmitadFeedProducts({ maxFeeds: 20, maxProductsPerFeed: 300, deadlineMs: ADMITAD_FEED_CATALOG_BUDGET_MS })),
          new Promise<{ offers: import("@/lib/integrations/admitad/types").AdmitadFeedOffer[]; feedName: string; feedSlug: string }[]>((resolve) =>
            setTimeout(() => resolve([]), ADMITAD_FEED_CATALOG_BUDGET_MS + 1_000),
          ),
        ])
          .then((feeds) => feeds ?? [])
          .catch(() => [] as { offers: import("@/lib/integrations/admitad/types").AdmitadFeedOffer[]; feedName: string; feedSlug: string }[]),
      ]);

      const { admitadFeedsToCatalogItems } = await import("@/lib/integrations/admitad");
      const fromAdmitad: NormalizedCatalogItem[] = admitadFeedsToCatalogItems(admitadFeeds);

      const merged = [...fromSearch];

      for (const dbItem of fromDb) {
        if (!merged.some((live) => isDuplicate(live, dbItem))) {
          merged.push(dbItem);
        }
      }

      for (const ingested of fromIngestion) {
        if (!merged.some((live) => isDuplicate(live, ingested))) {
          merged.push(ingested);
        }
      }

      for (const admitadItem of fromAdmitad) {
        if (!merged.some((live) => isDuplicate(live, admitadItem))) {
          merged.push(admitadItem);
        }
      }

      // Image backfill: when a product snapshot carries a genuinely valid image
      // for the same product (matched by normalized title) but another snapshot
      // for that product resolved to the placeholder, prefer the real image so
      // valid product photos always render. The placeholder is only kept when no
      // snapshot anywhere has a usable image.
      let validImageByTitle: Map<string, string> | null = null;
      for (const item of merged) {
        const normal = normalizeTitle(item.title);
        if (!normal) continue;
        if (item.imageUrl && item.imageUrl !== PRODUCT_IMAGE_PLACEHOLDER) {
          validImageByTitle ??= new Map();
          if (!validImageByTitle.has(normal)) validImageByTitle.set(normal, item.imageUrl);
        }
      }
      if (validImageByTitle) {
        for (const item of merged) {
          const normal = normalizeTitle(item.title);
          if (!normal) continue;
          const hasReal = item.imageUrl && item.imageUrl !== PRODUCT_IMAGE_PLACEHOLDER;
          if (!hasReal) {
            const real = validImageByTitle.get(normal);
            if (real) item.imageUrl = real;
          }
        }
      }

      // Single source of truth: the homepage catalog must be a SUPERSET of
      // every provider that is live, additive to whatever was visible before.
      // We keep products from every provider that can produce real data and
      // only drop the clearly stub-only providers (no credentials, no live
      // connector) that could otherwise leak placeholder rows through
      // getCatalogItemsFromDatabase(). Live providers (aliExpress, eBay,
      // Amazon US/EG, CJdropshipping, Admitad) are never excluded here.
      const activeFiltered = merged.filter((item) => {
        const providerId = resolveMarketplaceId(
          item.providerIds[0] ?? item.offers[0]?.providerId ?? "unknown",
        );
        return !STUB_CATALOG_PROVIDERS.has(providerId);
      });

      if (activeFiltered.length > 0) {
        return balanceFlatMarketplaceList(
          activeFiltered,
          (item) => item.providerIds[0] ?? item.offers[0]?.providerId ?? "unknown",
          activeFiltered.length,
        );
      }

      const { items } = await fetchMergedCatalog();
      return items;
    } catch (error) {
      console.error("[catalog] merged fetch failed:", error);
      return [];
    }
  },
  ["homepage:merged-catalog-v13-image-fix"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["homepage-catalog"] },
);

const getCatalogItems = reactCache(async (): Promise<NormalizedCatalogItem[]> => {
  if (!HOMEPAGE_LIVE_FETCH_ENABLED) return [];

  const { applyCanonicalCatalogIfEnabled } = await import(
    "@/lib/canonical/consumption/homepage"
  );

  const { isAnyProductionProviderConfigured } = await import(
    "@/lib/integration/comparison-engine"
  );
  if (!isAnyProductionProviderConfigured()) {
    const { getCatalogItemsFromDatabase } = await import(
      "@/lib/integration/database-catalog"
    );
    return applyCanonicalCatalogIfEnabled(
      await getCatalogItemsFromDatabase().catch(() => []),
    );
  }

  void scheduleAdmitadIngestionIfStale();

  return applyCanonicalCatalogIfEnabled(await loadMergedCatalogItems());
});

// ---------------------------------------------------------------------------
// Production ingestion auto-trigger
// ---------------------------------------------------------------------------

const ADMITAD_AUTO_INGEST_MIN_INTERVAL_MS = 30 * 60 * 1000;
const ADMITAD_AUTO_INGEST_STALE_MS = 12 * 60 * 60 * 1000;
let admitadAutoIngestLastAttemptMs = 0;
let admitadAutoIngestRunning = false;

/**
 * Keeps the admitad DB catalog fresh: when the newest ingested row is stale
 * (>12h), kick off a bounded multi-merchant ingestion AFTER the current
 * response finishes (Next.js after()). Runs at most once per 30 min per
 * instance, never blocks the page, and never weakens cron auth.
 */
async function scheduleAdmitadIngestionIfStale(): Promise<void> {
  if (admitadAutoIngestRunning) return;
  if (Date.now() - admitadAutoIngestLastAttemptMs < ADMITAD_AUTO_INGEST_MIN_INTERVAL_MS) {
    return;
  }
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  admitadAutoIngestLastAttemptMs = Date.now();

  if (!process.env.ADMITAD_CLIENT_ID || !process.env.ADMITAD_CLIENT_SECRET) return;

  try {
    const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
    const supabase = createSupabaseServiceClient();
    if (!supabase) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("lowest_prices_today")
      .select("computed_at")
      .eq("provider", "admitad")
      .order("computed_at", { ascending: false })
      .limit(1);
    if (!error && data?.[0]?.computed_at) {
      const ageMs = Date.now() - Date.parse(String(data[0].computed_at));
      if (Number.isFinite(ageMs) && ageMs < ADMITAD_AUTO_INGEST_STALE_MS) {
        return; // fresh enough — no ingestion needed
      }
    }
  } catch {
    // Staleness probe failed — attempt ingestion anyway.
  }

  console.log("[catalog] admitad catalog stale — starting bounded auto-ingestion");
  admitadAutoIngestRunning = true;
  const run = import("@/lib/integrations/admitad")
    .then((m) =>
      m.runAdmitadIngestion({
        maxFeeds: 3,
        maxProductsPerFeed: 300,
        deadlineMs: 45_000,
      }),
    )
    .then((res) => {
      console.log("[catalog] admitad auto-ingest finished:", JSON.stringify(res));
    })
    .catch((err) => {
      console.error(
        "[catalog] admitad auto-ingest failed:",
        err instanceof Error ? err.message : String(err),
      );
    })
    .finally(() => {
      admitadAutoIngestRunning = false;
    });

  try {
    const { after } = await import("next/server");
    after(() => run);
  } catch {
    void run;
  }
}

function itemsToCards(items: NormalizedCatalogItem[]): TrendingDealCard[] {
  return items.map((item) =>
    catalogItemToTrendingDealCard(item, {
      updatedMins: minutesSinceFetched(item.fetchedAt),
    }),
  );
}

/** Card count the homepage trending strip shows before the five sections. */
const TRENDING_SECTION_LIMIT = 8;

interface HomepageProductSurfaces {
  trending: TrendingDealCard[];
  sections: HomepageSectionProducts;
}

/**
 * ONE shared, cached homepage product selection.
 *
 * The trending strip claims its picks first, then the five section buckets
 * exclude every identity the strip already shows — so the same product can
 * never appear in more than one of the six homepage surfaces. Because this is
 * a single cached promise, `CommerceSection` (trending) and
 * `ProductSectionsContent` (sections) always render consistent,
 * exclusion-matched sets within the same request.
 */
const getHomepageProductSurfaces = reactCache(
  async (): Promise<HomepageProductSurfaces> => {
    const items = await getCatalogItems();
    if (items.length === 0) {
      return { trending: [], sections: emptySectionProducts() };
    }

    const cards = itemsToCards(items);

    const trending = balanceCards(
      [...cards].sort((a, b) => b.discount - a.discount),
      TRENDING_SECTION_LIMIT,
      (a, b) => b.discount - a.discount,
    );

    const claimedKeys = new Set<string>();
    for (const trendCard of trending) {
      for (const key of cardIdentityKeys(trendCard)) {
        claimedKeys.add(key);
      }
    }

    return {
      trending,
      sections: buildHomepageSections(cards, claimedKeys),
    };
  },
);

/** Live trending deals — multi-marketplace balanced, shared with sections. */
export async function getIntegratedTrendingDeals(limit = 8): Promise<TrendingDealCard[]> {
  const { trending } = await getHomepageProductSurfaces();
  return trending.slice(0, limit);
}

/** Live deals for /deals page — multi-marketplace balanced. */
export async function getIntegratedDeals(limit = 48): Promise<Deal[]> {
  const items = await getCatalogItems();
  if (items.length === 0) return [];

  const sorted = [...items].sort(
    (a, b) => b.discount - a.discount || b.reviewCount - a.reviewCount,
  );
  const balanced = balanceCatalogItems(
    sorted,
    limit,
    (a, b) => b.discount - a.discount || b.reviewCount - a.reviewCount,
  );
  return balanced.map((item, index) => catalogItemToDeal(item, index));
}

/** Live homepage section buckets — exclude anything the trending strip shows. */
export async function getIntegratedSectionProducts(): Promise<HomepageSectionProducts> {
  const { sections } = await getHomepageProductSurfaces();
  return sections;
}

export {
  isAnyProductionProviderConfigured,
  getConfiguredProductionProvidersList as getConfiguredProductionProviders,
} from "@/lib/integration/comparison-engine";

/** Expose the merged catalog for downstream consumers (e.g. homepage stats). */
export { getCatalogItems as getMergedCatalogItems };
