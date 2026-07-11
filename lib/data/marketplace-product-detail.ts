import type { SearchResultItem } from "@/lib/data/homepage";
import type { ProductDetail } from "@/lib/data/product-detail";
import type { Product, Store } from "@/lib/types/entities";
import type { CompareProductResult } from "@/services/compare";
import { getAliExpressProductDetail } from "@/services/aliexpress/search";
import { normalizeEbayRaw } from "@/lib/search/normalization";
import type { RawProviderListing, SearchProviderId } from "@/lib/search/types";
import { SEARCH_PROVIDER_IDS } from "@/lib/search/types";
import { marketplaceDisplayName } from "@/lib/search/price-comparison";

const STORE_META: Record<string, Pick<Store, "id" | "name" | "slug" | "website" | "logoInitial">> = {
  aliexpress: {
    id: "aliexpress",
    name: "AliExpress",
    slug: "aliexpress",
    website: "https://www.aliexpress.com",
    logoInitial: "AE",
  },
  ebay: {
    id: "ebay",
    name: "eBay",
    slug: "ebay",
    website: "https://www.ebay.com",
    logoInitial: "EB",
  },
  walmart: {
    id: "walmart",
    name: "Walmart",
    slug: "walmart",
    website: "https://www.walmart.com",
    logoInitial: "WM",
  },
  temu: {
    id: "temu",
    name: "Temu",
    slug: "temu",
    website: "https://www.temu.com",
    logoInitial: "TM",
  },
  bestbuy: {
    id: "bestbuy",
    name: "Best Buy",
    slug: "best-buy",
    website: "https://www.bestbuy.com",
    logoInitial: "BB",
  },
  noon: {
    id: "noon",
    name: "Noon",
    slug: "noon",
    website: "https://www.noon.com",
    logoInitial: "NN",
  },
  jumia: {
    id: "jumia",
    name: "Jumia",
    slug: "jumia",
    website: "https://www.jumia.com",
    logoInitial: "JM",
  },
};

function buildStore(slug: string, displayName?: string): Store {
  const meta = STORE_META[slug] ?? {
    id: slug,
    name: displayName || slug,
    slug,
    website: `https://www.${slug}.com`,
    logoInitial: slug.slice(0, 2).toUpperCase(),
  };
  const integrationType: Store["integrationType"] =
    slug === "aliexpress" ||
    slug === "ebay" ||
    slug === "amazon" ||
    slug === "walmart" ||
    slug === "temu" ||
    slug === "noon"
      ? (slug as Store["integrationType"])
      : "partner";
  return {
    ...meta,
    integrationType,
    commissionRate: 0,
    supportedRegions: ["US"],
    supportedCurrencies: ["USD"],
    isActive: true,
  };
}

export function parseMarketplaceProductId(id: string): {
  providerId: SearchProviderId | "unknown";
  externalId: string;
} {
  const trimmed = id.trim();
  for (const provider of SEARCH_PROVIDER_IDS) {
    const prefix = `${provider}-`;
    if (trimmed.toLowerCase().startsWith(prefix)) {
      return {
        providerId: provider,
        externalId: trimmed.slice(prefix.length),
      };
    }
  }
  // Legacy bare AliExpress numeric ids
  if (/^\d{6,}$/.test(trimmed)) {
    return { providerId: "aliexpress", externalId: trimmed };
  }
  return { providerId: "unknown", externalId: trimmed };
}

function rawListingToSearchItem(listing: RawProviderListing): SearchResultItem {
  return {
    id: `${listing.providerId}-${listing.externalId}`,
    name: listing.title,
    imageSrc: listing.imageUrl,
    emoji: "🛍️",
    price: listing.price,
    originalPrice: listing.originalPrice,
    discount: listing.discount,
    store: marketplaceDisplayName(listing.providerId),
    storeSlug: listing.providerId,
    rating: listing.rating,
    reviewCount: listing.reviewCount,
    salesCount: listing.salesCount,
    shipping: listing.shipping,
    inStock: listing.inStock,
    category: listing.category,
    affiliateUrl: listing.affiliateUrl ?? listing.productUrl,
  };
}

export function searchItemToProduct(item: SearchResultItem): Product {
  const { externalId } = parseMarketplaceProductId(item.id);
  return {
    id: item.id,
    name: item.name,
    slug: externalId.replace(/\|/g, "-"),
    description: item.name,
    imageUrl: item.imageSrc,
    emoji: item.emoji,
    categorySlug: (item.category || "general").toLowerCase().replace(/\s+/g, "-"),
    brand: item.store,
    rating: item.rating,
    reviewCount: item.salesCount ?? item.reviewCount,
    currency: "USD",
    countryCode: "US",
    inStock: item.inStock,
    tags: item.category ? [item.category] : [],
    isActive: true,
    lastSyncedAt: new Date().toISOString(),
  };
}

export function searchItemToCompareResult(item: SearchResultItem): CompareProductResult {
  const product = searchItemToProduct(item);
  const store = buildStore(item.storeSlug || "aliexpress", item.store);
  const discountPercent = item.discount;
  const offer = {
    id: `price-${item.id}`,
    productId: item.id,
    storeId: store.id,
    price: item.price,
    originalPrice: item.originalPrice,
    currency: "USD",
    countryCode: "US",
    inStock: item.inStock,
    isCurrent: true,
    recordedAt: new Date().toISOString(),
    store,
    provider: store.slug,
    discountPercent,
    isLowest: true,
    isHighestDiscount: true,
    externalUrl: item.affiliateUrl,
  };

  return {
    product,
    offers: [offer],
    lowestPrice: item.price,
    highestPrice: item.price,
    highestDiscount: discountPercent,
    savingsVsHighest: 0,
    savingsPercent: 0,
    providerCount: 1,
    cheapestStoreName: item.store,
    highestDiscountStoreName: item.store,
  };
}

export function searchItemToProductDetail(item: SearchResultItem): ProductDetail {
  const comparison = searchItemToCompareResult(item);
  return {
    product: comparison.product,
    categoryName: item.category || "General",
    comparison,
    images: [item.imageSrc],
    specifications: {
      Store: item.store,
      Category: item.category || "General",
      Rating: item.rating > 0 ? `${item.rating} / 5` : "—",
      Sales: String(item.salesCount ?? item.reviewCount ?? 0),
      Shipping: item.shipping ?? "Shipping varies by seller",
      Availability: item.inStock ? "In Stock" : "Out of Stock",
    },
    variants: [],
    priceHistory: [
      {
        id: `ph-${item.id}`,
        productId: item.id,
        price: item.price,
        currency: "USD",
        recordedAt: new Date().toISOString(),
      },
    ],
  };
}

async function getEbayProductDetail(externalId: string): Promise<ProductDetail | null> {
  const { loadEbayCredentials } = await import("@/services/ebay/credentials");
  const { createEbayClientFromEnv, isEbayConfigured } = await import(
    "@/lib/integrations/ebay"
  );

  await loadEbayCredentials();
  if (!isEbayConfigured()) return null;

  const client = createEbayClientFromEnv();
  if (!client) return null;

  try {
    const items = await client.getItemsByIds([externalId], "US");
    const raw = items[0];
    if (!raw) return null;
    const listing = normalizeEbayRaw(raw);
    if (!listing) return null;
    return searchItemToProductDetail(rawListingToSearchItem(listing));
  } catch (error) {
    console.error(
      "[ebay-detail]",
      error instanceof Error ? error.message : "eBay product detail failed",
    );
    return null;
  }
}

/**
 * Resolve PDP for any supported marketplace except Amazon.
 * Amazon is intentionally unsupported here (no connector changes).
 */
export async function resolveMarketplaceProductDetail(
  id: string,
): Promise<ProductDetail | null> {
  const { providerId, externalId } = parseMarketplaceProductId(id);

  if (providerId === "amazon") {
    return null;
  }

  if (providerId === "ebay") {
    return getEbayProductDetail(externalId);
  }

  if (providerId === "aliexpress" || providerId === "unknown") {
    const ae = await getAliExpressProductDetail(
      providerId === "aliexpress" ? `aliexpress-${externalId}` : id,
    );
    if (ae) return ae;
    if (providerId === "unknown") {
      // Last resort: try eBay Browse for raw ids that look like Browse item ids
      if (externalId.includes("|") || externalId.startsWith("v1")) {
        return getEbayProductDetail(externalId);
      }
    }
    return null;
  }

  // Walmart / Temu / others: no dedicated detail API yet — try sync-bridged search cache miss
  // Prefer notFound over fake Amazon/mock data.
  return null;
}
