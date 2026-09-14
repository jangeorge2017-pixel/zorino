/**
 * Homepage section assembly — pure, data-in → sections-out.
 *
 * Extracted from catalog-service so the diversity/balancing rules are
 * unit-testable without the catalog fetch graph (DB, search fan-out, feeds).
 * Behavior is identical to the historical inline implementation.
 */
import { balanceFlatMarketplaceList } from "@/lib/search/marketplace-balance";
import { resolveMarketplaceId } from "@/lib/search/resolve-marketplace-id";
import type { HomepageSectionProducts } from "@/lib/data/homepage";
import type { NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import type { TrendingDealCard } from "@/lib/types/entities";

const SECTION_LIMIT = 4;

/** Minutes since the snapshot was fetched — the real recency signal. */
export function minutesSinceFetched(fetchedAt: string): number {
  const at = Date.parse(fetchedAt);
  if (!Number.isFinite(at)) return 5;
  return Math.max(0, Math.round((Date.now() - at) / 60_000));
}

function providerIdFromCatalogItem(item: NormalizedCatalogItem): string {
  return resolveMarketplaceId(
    item.providerIds[0] ?? item.offers[0]?.providerId ?? item.offers[0]?.storeSlug ?? "unknown",
  );
}

function providerIdFromCard(card: TrendingDealCard): string {
  const fromId = resolveMarketplaceId(String(card.productId ?? card.id));
  if (fromId !== "unknown") return fromId;
  return resolveMarketplaceId(card.store || "unknown");
}

/**
 * Merchant-aware balance key.
 *
 * Admitad carries many unrelated merchants under one provider id (Glasseslit
 * WW, Alibaba WW, AJZZ, ...). Balancing on the provider id alone lets a single
 * merchant with the highest discounts fill every discount-sorted slot (and,
 * because `db-*` ids resolve per-product, every incompatible `db-*` product
 * previously became its own bucket — neither provider-level nor merchant-level).
 *
 * Keying on the offer store name gives every distinct merchant its own bucket,
 * so round-robin distributes across merchants rather than across providers.
 * Live providers keep one bucket each because their store name equals the
 * provider display name.
 */
export function merchantKeyFromCard(card: TrendingDealCard): string {
  const name = (card.store ?? "").trim();
  if (name) return `merchant:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return `provider:${providerIdFromCard(card)}`;
}

/** Item equivalent of {@link merchantKeyFromCard}. */
export function merchantKeyFromCatalogItem(item: NormalizedCatalogItem): string {
  const name = item.offers[0]?.storeName?.trim();
  if (name) return `merchant:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return `provider:${providerIdFromCatalogItem(item)}`;
}

/** Mix catalog items fairly across whatever merchants / marketplaces are present. */
export function balanceCatalogItems(
  items: NormalizedCatalogItem[],
  limit: number,
  compare?: (a: NormalizedCatalogItem, b: NormalizedCatalogItem) => number,
): NormalizedCatalogItem[] {
  return balanceFlatMarketplaceList(items, merchantKeyFromCatalogItem, limit, compare);
}

export function balanceCards(
  cards: TrendingDealCard[],
  limit: number,
  compare?: (a: TrendingDealCard, b: TrendingDealCard) => number,
): TrendingDealCard[] {
  return balanceFlatMarketplaceList(cards, merchantKeyFromCard, limit, compare);
}

function uniqueCards(cards: TrendingDealCard[]): TrendingDealCard[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = String(card.productId ?? card.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Short-title fingerprint (lowercased, punctuation stripped, meaningful words
 * only), matching the merge-layer normalization so identity matching stays
 * consistent with how cross-source duplicates are collapsed upstream.
 */
function titleFingerprint(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 5)
    .join(" ")
    .trim();
}

/**
 * Robust identity keys for a homepage card.
 *
 * - Exact key: the stable catalog `productId` (fallback `id`) — the canonical
 *   identity used everywhere.
 * - Merchant-scoped title fingerprint: when the SAME real product reaches the
 *   merged catalog under two different ids (e.g. a `db-*` row vs a
 *   `providerId-*` search hit for the same shop), this key still recognizes it
 *   as one product. Because it is namespaced by the merchant, genuinely
 *   different products from different providers are never merged, even when
 *   their short titles coincide.
 */
export function cardIdentityKeys(card: TrendingDealCard): string[] {
  const exact = String(card.productId ?? card.id);
  if (!exact) return [];
  const fingerprint = titleFingerprint(card.name);
  return fingerprint
    ? [exact, `${merchantKeyFromCard(card)}::title:${fingerprint}`]
    : [exact];
}

/** Collapse cards sharing any identity key, keeping the first occurrence. */
function uniqueByIdentity(cards: TrendingDealCard[]): TrendingDealCard[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const keys = cardIdentityKeys(card);
    if (keys.some((key) => seen.has(key))) return false;
    for (const key of keys) seen.add(key);
    return true;
  });
}

function prefixCards(cards: TrendingDealCard[], prefix: string): TrendingDealCard[] {
  return cards.map((card) => ({ ...card, id: `${prefix}-${card.id}` }));
}

/** Empty sections shape — returned when the catalog has no products. */
export function emptySectionProducts(): HomepageSectionProducts {
  return { flash: [], priceDrops: [], newArrivals: [], topRated: [], editorsPicks: [] };
}

/**
 * Build the five homepage section buckets from cards.
 *
 * Diversity rules (Fix 1):
 * 1. No product is reused across sections — each section draws from the full
 *    pool but anything already shown in an earlier bucket is excluded, so the
 *    five buckets show five distinct products instead of the same top discounts.
 * 2. Every section is merchant-balanced — a single merchant (e.g. Glasseslit
 *    under Admitad) cannot fill every discount slot; round-robin spreads picks
 *    across distinct merchants.
 * 3. `newArrivals` uses the real snapshot age (`updatedMins`) so ordering is by
 *    actual recency rather than the constant placeholder.
 *
 * Cross-surface exclusion (Fix 6):
 * 4. `excludeKeys` seeds the claimed set with identities already shown by the
 *    sibling trending strip, so a product featured in Trending Deals can never
 *    reappear in a section bucket. Exclusion matches on the full identity key
 *    set (exact productId + merchant-scoped title fingerprint), recognising the
 *    same real product across source formats without merging different
 *    providers' products.
 */
export function buildHomepageSections(
  cards: TrendingDealCard[],
  excludeKeys?: Iterable<string>,
): HomepageSectionProducts {
  const unique = uniqueCards(cards);
  if (unique.length === 0) return emptySectionProducts();

  const byDiscount = [...unique].sort((a, b) => b.discount - a.discount);
  const priceDropsPool = unique
    .filter((card) => card.originalPrice > card.price)
    .sort((a, b) => b.discount - a.discount);
  const byRating = [...unique].sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
  const byRecent = [...unique].sort((a, b) => a.updatedMins - b.updatedMins);

  const usedIdentityKeys = new Set<string>(excludeKeys ?? []);

  const takeSection = (
    pool: TrendingDealCard[],
    limit: number,
    compare: (a: TrendingDealCard, b: TrendingDealCard) => number,
  ): TrendingDealCard[] => {
    const notClaimed = pool.filter(
      (card) => !cardIdentityKeys(card).some((key) => usedIdentityKeys.has(key)),
    );
    const available = uniqueByIdentity(notClaimed);
    const picks = balanceCards(available, limit, compare);
    for (const pick of picks) {
      for (const key of cardIdentityKeys(pick)) {
        usedIdentityKeys.add(key);
      }
    }
    return picks;
  };

  return {
    flash: prefixCards(
      takeSection(byDiscount, SECTION_LIMIT, (a, b) => b.discount - a.discount),
      "flash",
    ),
    priceDrops: prefixCards(
      takeSection(
        priceDropsPool.length > 0 ? priceDropsPool : byDiscount,
        SECTION_LIMIT,
        (a, b) => b.discount - a.discount,
      ),
      "drop",
    ),
    newArrivals: prefixCards(
      takeSection(byRecent, SECTION_LIMIT, (a, b) => a.updatedMins - b.updatedMins),
      "new",
    ),
    topRated: prefixCards(
      takeSection(byRating, SECTION_LIMIT, (a, b) => b.rating - a.rating || b.reviews - a.reviews),
      "rated",
    ),
    editorsPicks: prefixCards(
      takeSection(byRating, SECTION_LIMIT, (a, b) => b.rating - a.rating || b.reviews - a.reviews),
      "pick",
    ),
  };
}