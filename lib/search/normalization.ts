import { formatAliExpressShipping, formatAliExpressStoreName } from "@/lib/integrations/aliexpress/map-product";
import type { AmazonRawProduct } from "@/lib/integrations/amazon/client";
import { getAmazonAssociateTag } from "@/lib/integrations/amazon/config";
import type { AliExpressRawProduct } from "@/lib/integrations/aliexpress/types";
import type { EbayRawProduct } from "@/lib/integrations/ebay/types";
import { buildAffiliateUrl } from "@/lib/affiliate/generate";
import type { AffiliateMarketplace } from "@/lib/affiliate/config";
import type {
  OxylabsAmazonMarketplaceKey,
  OxylabsAmazonProduct,
} from "@/lib/integrations/oxylabs";
import { OXYLABS_AMAZON_MARKETPLACES } from "@/lib/integrations/oxylabs";
import { getIntegrationCredential } from "@/lib/integration/credentials";
import { computeDiscountPercent } from "@/lib/integration/normalize";
import {
  getProviderStoreMeta,
  searchProviderToProductionId,
} from "@/lib/integration/provider-context";
import type { ProductMatchTier } from "@/lib/search/relevance";
import type {
  NormalizedSearchListing,
  RawProviderListing,
  SearchProviderId,
} from "@/lib/search/types";
import type { ExternalProduct } from "@/lib/sync/types";

function upgradeAliExpressImage(url: string): string {
  if (!url) return url;
  return url.replace(/_\d+x\d+\./, "_960x960.");
}

function upgradeEbayImage(url: string): string {
  if (!url) return url;
  return url.replace(/s-l\d+\./, "s-l1600.");
}

function parseRating(evaluateRate?: string): number {
  if (!evaluateRate) return 0;
  const numeric = parseFloat(evaluateRate.replace("%", ""));
  if (!Number.isFinite(numeric)) return 0;
  if (numeric > 5) return Math.min(5, Math.round((numeric / 20) * 10) / 10);
  return Math.min(5, Math.round(numeric * 10) / 10);
}

function parseSalesCount(volume?: string | number): number {
  if (volume == null) return 0;
  const n = typeof volume === "number" ? volume : parseInt(volume, 10);
  return Number.isFinite(n) ? n : 0;
}

/** AliExpress Affiliates API → raw provider listing. */
export function normalizeAliExpressRaw(raw: AliExpressRawProduct): RawProviderListing | null {
  const externalId = raw.product_id != null ? String(raw.product_id) : "";
  if (!externalId || !raw.product_title) return null;

  const price = parseFloat(raw.target_sale_price ?? raw.sale_price ?? "0");
  if (!price || price <= 0) return null;

  const original = parseFloat(raw.target_original_price ?? raw.original_price ?? "0");
  const originalPrice = original > price ? original : price;
  const discount =
    originalPrice > price
      ? Math.max(0, Math.round(((originalPrice - price) / originalPrice) * 100))
      : 0;

  const affiliateLink =
    raw.promotion_link?.trim() ||
    raw.product_detail_url?.trim() ||
    raw.shop_url?.trim() ||
    "";
  if (!affiliateLink) return null;

  const imageUrl = upgradeAliExpressImage(raw.product_main_image_url ?? "");
  if (!imageUrl.startsWith("http")) return null;

  const salesCount = parseSalesCount(raw.lastest_volume);

  return {
    providerId: "aliexpress",
    externalId,
    title: raw.product_title.trim(),
    imageUrl,
    price,
    originalPrice,
    discount,
    currency:
      raw.target_sale_price_currency?.trim() ||
      raw.sale_price_currency?.trim() ||
      "USD",
    storeName: formatAliExpressStoreName(raw),
    category: raw.first_level_category_name?.trim() || "General",
    rating: parseRating(raw.evaluate_rate),
    reviewCount: salesCount,
    salesCount,
    shipping: formatAliExpressShipping(raw),
    inStock: true,
    productUrl: affiliateLink,
    affiliateUrl: affiliateLink,
  };
}

/** Amazon PA-API → raw provider listing. */
export function normalizeAmazonRaw(raw: AmazonRawProduct): RawProviderListing | null {
  if (!raw.asin || !raw.title) return null;

  const associateTag = getAmazonAssociateTag();
  const affiliateUrl = raw.affiliateUrl?.trim() || raw.productUrl?.trim() || "";
  if (!affiliateUrl || !affiliateUrl.includes(associateTag)) return null;

  const price = raw.price;
  if (!price || price <= 0) return null;

  const originalPrice = raw.originalPrice > price ? raw.originalPrice : price;
  const discount =
    originalPrice > price
      ? Math.max(0, Math.round(((originalPrice - price) / originalPrice) * 100))
      : 0;

  const imageUrl = raw.imageUrl ?? "";
  if (!imageUrl.startsWith("http")) return null;

  return {
    providerId: "amazon",
    externalId: raw.asin,
    title: raw.title.trim(),
    imageUrl,
    price,
    originalPrice,
    discount,
    currency: raw.currency?.trim() || "USD",
    storeName: "Amazon",
    category: raw.category?.trim() || "General",
    rating: raw.rating ?? 0,
    reviewCount: raw.reviewCount ?? 0,
    inStock: raw.inStock,
    productUrl: raw.productUrl,
    affiliateUrl,
  };
}

/**
 * Map an Oxylabs real Amazon product onto the SAME unified marketplace product
 * shape as the existing Amazon connectors. The marketplace key decides which
 * Zorino store/provider the product belongs to (US/UK → "amazon", EG →
 * "amazon-eg") so Oxylabs never replaces an existing Amazon store — it feeds
 * the existing store mapping via the shared normalization/canonical pipeline.
 */
export function normalizeOxylabsAmazonRaw(
  raw: OxylabsAmazonProduct,
  marketplace: OxylabsAmazonMarketplaceKey
): RawProviderListing | null {
  if (!raw.asin || !raw.title) return null;

  const isEgypt = marketplace === "amazon-eg";
  const providerId: SearchProviderId = isEgypt ? "amazon-eg" : "amazon";
  const storeName = isEgypt ? "Amazon Egypt" : "Amazon";
  const affiliateMarketplace: AffiliateMarketplace = isEgypt
    ? "amazon-eg"
    : "amazon";

  const price = raw.price;
  if (!price || price <= 0) return null;

  const originalPrice = raw.originalPrice > price ? raw.originalPrice : price;
  const discount =
    originalPrice > price
      ? Math.max(0, Math.round(((originalPrice - price) / originalPrice) * 100))
      : 0;

  const imageUrl = raw.imageUrl ?? "";
  if (!imageUrl.startsWith("http")) return null;

  const affiliateUrl = buildAffiliateUrl({
    destinationUrl: raw.productUrl,
    marketplace: affiliateMarketplace,
    partnerTag: isEgypt ? "zorinoeg-21" : getAmazonAssociateTag(),
  });

  return {
    providerId,
    externalId: raw.asin,
    title: raw.title.trim(),
    imageUrl,
    price,
    originalPrice,
    discount,
    currency: raw.currency?.trim() || OXYLABS_AMAZON_MARKETPLACES[marketplace].currency,
    storeName,
    category: raw.category?.trim() || "General",
    rating: raw.rating ?? 0,
    reviewCount: raw.reviewCount ?? 0,
    inStock: raw.inStock,
    productUrl: raw.productUrl,
    affiliateUrl,
  };
}

/** eBay Browse API → raw provider listing. */
export function normalizeEbayRaw(raw: EbayRawProduct): RawProviderListing | null {
  if (!raw.itemId || !raw.title) return null;

  const price = parseFloat(raw.price?.value ?? "0");
  if (!price || price <= 0) return null;

  const marketingOriginal = parseFloat(raw.marketingPrice?.originalPrice?.value ?? "0");
  const originalPrice = marketingOriginal > price ? marketingOriginal : price;
  const discountFromApi = raw.marketingPrice?.discountPercentage
    ? Math.round(parseFloat(raw.marketingPrice.discountPercentage))
    : 0;
  const discount =
    discountFromApi > 0
      ? discountFromApi
      : originalPrice > price
        ? Math.round(((originalPrice - price) / originalPrice) * 100)
        : 0;

  const rawProductUrl = raw.itemWebUrl?.trim() || "";
  const affiliateFromApi = raw.itemAffiliateWebUrl?.trim() || "";
  let affiliateUrl = affiliateFromApi || rawProductUrl;
  if (!affiliateUrl) return null;

  // Ensure ePN tracking when Browse API omitted itemAffiliateWebUrl.
  const campaignId =
    getIntegrationCredential("EBAY_CAMPAIGN_ID")?.trim() ||
    process.env.EBAY_CAMPAIGN_ID?.trim() ||
    "";
  if (!affiliateFromApi && campaignId && rawProductUrl) {
    try {
      const url = new URL(rawProductUrl);
      url.searchParams.set("campid", campaignId);
      url.searchParams.set("customid", `zorino-${raw.itemId}`);
      affiliateUrl = url.toString();
    } catch {
      affiliateUrl = rawProductUrl;
    }
  }

  const productUrl = affiliateUrl;

  const imageCandidate =
    raw.image?.imageUrl ??
    raw.additionalImages?.[0]?.imageUrl ??
    "";
  const imageUrl = upgradeEbayImage(imageCandidate);
  if (!imageUrl.startsWith("http")) return null;

  const qty = raw.estimatedAvailabilities?.[0]?.estimatedAvailableQuantity;
  const inStock =
    qty !== undefined ? qty > 0 : (raw.buyingOptions ?? []).includes("FIXED_PRICE");

  return {
    providerId: "ebay",
    externalId: raw.itemId,
    title: raw.title.trim(),
    imageUrl,
    price,
    originalPrice,
    discount,
    currency: raw.price?.currency ?? "USD",
    storeName: raw.seller?.username?.trim() || "eBay",
    category: raw.condition?.trim() || "General",
    rating: 0,
    reviewCount: 0,
    inStock,
    productUrl,
    affiliateUrl,
  };
}

/** Map sync-layer ExternalProduct → search RawProviderListing. */
export function externalProductToRawListing(
  product: ExternalProduct,
  providerId: SearchProviderId
): RawProviderListing | null {
  const productionId = searchProviderToProductionId(providerId);
  if (!productionId) return null;

  const meta = getProviderStoreMeta(productionId);
  const originalPrice = product.originalPrice ?? product.price;
  const discount = product.discount ?? computeDiscountPercent(product.price, originalPrice);

  return {
    providerId,
    externalId: product.externalId,
    title: product.title,
    imageUrl: product.imageUrl,
    price: product.price,
    originalPrice,
    discount,
    currency: product.currency,
    storeName: meta.name,
    category: product.categorySlug,
    rating: product.rating ?? 0,
    reviewCount: product.reviewCount ?? 0,
    inStock: product.inStock,
    productUrl: product.affiliateUrl ?? product.productUrl,
    affiliateUrl: product.affiliateUrl ?? product.productUrl,
  };
}

type CJRawProduct = {
  pid?: string;
  productNameEn?: string;
  productName?: string;
  productImage?: string | string[];
  productImageSet?: string[];
  sellPrice?: number | string;
  suggestSellPrice?: number | string;
  categoryName?: string;
};

/**
 * CJdropshipping public product URLs use the canonical
 * `/product/<title-slug>-p-<pid>.html` format. The bare `/product/<pid>.html`
 * form returns HTTP 404 on cjdropshipping.com.
 */
function buildCjProductUrl(pid: string, title: string): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "product";
  return `https://cjdropshipping.com/product/${slug}-p-${pid}.html`;
}

/** CJdropshipping API → raw provider listing. */
export function normalizeCJRaw(raw: CJRawProduct): RawProviderListing | null {
  const externalId = raw.pid ?? "";
  const title = (raw.productNameEn ?? raw.productName ?? "").trim();
  if (!externalId || !title) return null;

  const price = Number(raw.sellPrice ?? raw.suggestSellPrice ?? 0);
  if (!price || price <= 0) return null;

  const imageCandidates: unknown[] = [
    ...(Array.isArray(raw.productImage) ? raw.productImage : [raw.productImage]),
    ...(raw.productImageSet ?? []),
  ];
  const imageUrl =
    imageCandidates.find(
      (candidate): candidate is string =>
        typeof candidate === "string" && candidate.startsWith("http"),
    ) ?? "";
  if (!imageUrl) return null;

  const suggestPrice = Number(raw.suggestSellPrice ?? 0);
  const originalPrice = suggestPrice > price ? suggestPrice : price;
  const discount =
    originalPrice > price
      ? Math.max(0, Math.round(((originalPrice - price) / originalPrice) * 100))
      : 0;

  const productUrl = buildCjProductUrl(externalId, title);

  return {
    providerId: "cjdropshipping",
    externalId,
    title,
    imageUrl,
    price,
    originalPrice,
    discount,
    currency: "USD",
    storeName: "CJdropshipping",
    category: raw.categoryName?.trim() || "General",
    rating: 0,
    reviewCount: 0,
    inStock: true,
    productUrl,
    affiliateUrl: productUrl,
  };
}

type AdmitadOffer = {
  id: string;
  name: string;
  price: number;
  oldprice: number | null;
  currencyId: string;
  url: string;
  image: string;
  vendor: string;
};

/** Admitad feed offer → raw provider listing. */
export function normalizeAdmitadRaw(
  offer: AdmitadOffer,
  feedName: string,
): RawProviderListing | null {
  if (!offer.id || !offer.name || offer.price <= 0) return null;

  const originalPrice = offer.oldprice && offer.oldprice > offer.price ? offer.oldprice : offer.price;
  const discount =
    originalPrice > offer.price
      ? Math.max(0, Math.round(((originalPrice - offer.price) / originalPrice) * 100))
      : 0;

  const imageUrl = offer.image || "";
  const affiliateUrl = offer.url || "";
  if (!affiliateUrl) return null;

  return {
    providerId: "admitad",
    externalId: `admitad-${offer.id}`,
    title: offer.name.trim(),
    imageUrl,
    price: offer.price,
    originalPrice,
    discount,
    currency: offer.currencyId || "USD",
    storeName: feedName || "Alibaba",
    category: "General",
    rating: 0,
    reviewCount: 0,
    inStock: true,
    productUrl: affiliateUrl,
    affiliateUrl,
  };
}

export function toNormalizedListing(
  raw: RawProviderListing,
  analysis: { score: number; tier: ProductMatchTier; isDevice: boolean }
): NormalizedSearchListing {
  return {
    ...raw,
    id: `${raw.providerId}-${raw.externalId}`,
    storeSlug: raw.providerId,
    relevanceScore: analysis.score,
    matchTier: analysis.tier,
    isDevice: analysis.isDevice,
  };
}

export function normalizeRawListing(
  raw: RawProviderListing,
  analysis: { score: number; tier: ProductMatchTier; isDevice: boolean }
): NormalizedSearchListing {
  return toNormalizedListing(raw, analysis);
}
