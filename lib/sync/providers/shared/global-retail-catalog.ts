import { createSign, randomUUID } from "node:crypto";
import { fetchJson } from "@/lib/sync/providers/shared/http";
import { mapProviderCategory } from "@/lib/sync/providers/shared/category-map";
import { finalizeExternalProduct, slugifyTitle } from "@/lib/sync/providers/shared/product-utils";
import type { ExternalProduct, SyncContext } from "@/lib/sync/types";

const BESTBUY_SHOW = [
  "sku",
  "name",
  "image",
  "url",
  "salePrice",
  "regularPrice",
  "customerRating",
  "numReviews",
  "onlineAvailability",
  "categoryName",
  "manufacturer",
  "thumbnailImage",
].join(",");

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function firstString(value: unknown, keys: string[]): string {
  const record = asRecord(value);
  if (!record) return "";
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (typeof candidate === "number" && Number.isFinite(candidate)) return String(candidate);
  }
  return "";
}

function firstNumber(value: unknown, keys: string[]): number {
  const record = asRecord(value);
  if (!record) return 0;
  for (const key of keys) {
    const candidate = record[key];
    const numeric =
      typeof candidate === "number"
        ? candidate
        : typeof candidate === "string"
          ? Number(candidate.replace(/[$,]/g, "").trim())
          : Number.NaN;
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }
  return 0;
}

function firstBoolean(value: unknown, keys: string[]): boolean | null {
  const record = asRecord(value);
  if (!record) return null;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "boolean") return candidate;
    if (candidate === "true" || candidate === 1) return true;
    if (candidate === "false" || candidate === 0) return false;
  }
  return null;
}

function extractItems(payload: unknown): UnknownRecord[] {
  const root = asRecord(payload);
  if (!root) return [];
  const candidates = [root.items, root.products, root.results, asRecord(root.searchResult)?.items];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.map(asRecord).filter((item): item is UnknownRecord => item !== null);
    }
  }
  const nested = asRecord(root.searchResult);
  return nested ? extractItems(nested) : [];
}

function toExternalProduct(
  providerId: string,
  item: UnknownRecord,
  ctx: SyncContext,
  imageUrl: string,
  productUrl: string,
  title: string,
  externalId: string,
): ExternalProduct | null {
  const price = firstNumber(item, ["salePrice", "price", "currentPrice", "minPrice"]);
  if (!externalId || !title || !imageUrl || !productUrl || price <= 0) return null;
  if (!/^https?:\/\//i.test(imageUrl) || !/^https?:\/\//i.test(productUrl)) return null;

  const originalPrice = firstNumber(item, ["regularPrice", "originalPrice", "msrp", "listPrice"]);
  const effectiveOriginalPrice = originalPrice > price ? originalPrice : price;
  const discount =
    effectiveOriginalPrice > price
      ? Math.round(((effectiveOriginalPrice - price) / effectiveOriginalPrice) * 100)
      : 0;
  const inStock = firstBoolean(item, ["inStock", "onlineAvailability", "available"]) ?? true;
  const rating = firstNumber(item, ["customerRating", "averageRating", "rating", "averageOverallRating"]);
  const reviewCount = firstNumber(item, ["numReviews", "reviewCount", "numberOfReviews"]);
  const category = firstString(item, ["categoryName", "category", "categoryPath"]);

  return finalizeExternalProduct(ctx, {
    externalId: `${providerId}:${externalId}`,
    title,
    slug: slugifyTitle(`${providerId}-${externalId}-${title}`),
    categorySlug: mapProviderCategory(category, title, "home"),
    imageUrl,
    imageUrls: [imageUrl],
    price,
    originalPrice: effectiveOriginalPrice,
    currency: ctx.currency,
    countryCode: ctx.countryCode,
    rating,
    reviewCount,
    inStock,
    productUrl,
    discount,
    discountType: "percentage",
  });
}

function walmartAuthHeaders(): Record<string, string> | null {
  const consumerId = process.env.WALMART_CONSUMER_ID?.trim();
  const privateKey = process.env.WALMART_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!consumerId || !privateKey) return null;

  const keyVersion = process.env.WALMART_KEY_VERSION?.trim() || "1";
  const timestamp = Date.now().toString();
  const signature = createSign("RSA-SHA256")
    .update([consumerId, timestamp, keyVersion].join("\n"))
    .sign(privateKey, "base64");

  return {
    "WM_CONSUMER.ID": consumerId,
    "WM_CONSUMER.INTIMESTAMP": timestamp,
    "WM_SEC.KEY_VERSION": keyVersion,
    "WM_SEC.AUTH_SIGNATURE": signature,
  };
}

export function isWalmartConfigured(): boolean {
  return Boolean(
    process.env.WALMART_API_KEY?.trim() ||
      (process.env.WALMART_CONSUMER_ID?.trim() && process.env.WALMART_PRIVATE_KEY?.trim()),
  );
}

export function isBestBuyConfigured(): boolean {
  return Boolean(process.env.BESTBUY_API_KEY?.trim());
}

export async function fetchWalmartCatalog(ctx: SyncContext): Promise<ExternalProduct[]> {
  if (!isWalmartConfigured()) return [];

  const jobConfig = ctx.jobConfig;
  const queries =
    jobConfig?.keywords && jobConfig.keywords.length > 0
      ? jobConfig.keywords
      : ["iphone", "samsung galaxy", "laptop", "smart tv", "gaming", "home appliances"];
  const maxPages = Math.min(Math.max(jobConfig?.maxPages ?? 2, 1), 5);
  const pageSize = Math.min(Math.max(jobConfig?.pageSize ?? 25, 1), 25);
  const authHeaders = walmartAuthHeaders();
  const endpoint =
    process.env.WALMART_SEARCH_ENDPOINT?.trim() ||
    (authHeaders
      ? "https://developer.api.walmart.com/api-proxy/service/affil/product/v2/search"
      : "https://api.walmart.com/v3/items/search");
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(authHeaders ?? {}),
    ...(!authHeaders && process.env.WALMART_API_KEY?.trim()
      ? { "WALMART_API_KEY": process.env.WALMART_API_KEY.trim() }
      : {}),
  };
  const publisherId = process.env.WALMART_PUBLISHER_ID?.trim();
  const products: ExternalProduct[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    for (let page = 1; page <= maxPages; page++) {
      const params = new URLSearchParams({
        query,
        numItems: String(pageSize),
        start: String((page - 1) * pageSize),
        responseGroup: "full",
        sort: "relevance",
      });
      if (publisherId) params.set("publisherId", publisherId);
      if (!authHeaders && process.env.WALMART_API_KEY?.trim()) {
        params.set("apiKey", process.env.WALMART_API_KEY.trim());
      }

      let payload: unknown;
      try {
        payload = await fetchJson<unknown>(`${endpoint}?${params.toString()}`, {
          headers,
          timeoutMs: 20_000,
        });
      } catch {
        break;
      }

      const items = extractItems(payload);
      if (items.length === 0) break;
      for (const item of items) {
        const externalId =
          firstString(item, ["itemId", "id", "productId", "usItemId", "upc"]) ||
          (publisherId ? `${publisherId}:${randomUUID()}` : "");
        const title = firstString(item, ["name", "title"]);
        const imageUrl = firstString(item, ["image", "imageUrl", "thumbnailImage", "mediumImage"]);
        const productUrl = firstString(item, ["productUrl", "itemUrl", "url", "canonicalUrl"]);
        if (!externalId || seen.has(externalId)) continue;
        const product = toExternalProduct(
          "walmart",
          item,
          ctx,
          imageUrl,
          productUrl,
          title,
          externalId,
        );
        if (!product) continue;
        seen.add(externalId);
        products.push(product);
      }
    }
  }

  return products;
}

export async function fetchBestBuyCatalog(ctx: SyncContext): Promise<ExternalProduct[]> {
  const apiKey = process.env.BESTBUY_API_KEY?.trim();
  if (!apiKey) return [];

  const jobConfig = ctx.jobConfig;
  const queries =
    jobConfig?.keywords && jobConfig.keywords.length > 0
      ? jobConfig.keywords
      : ["iphone", "samsung galaxy", "laptop", "smart tv", "gaming console", "home appliances"];
  const maxPages = Math.min(Math.max(jobConfig?.maxPages ?? 2, 1), 5);
  const pageSize = Math.min(Math.max(jobConfig?.pageSize ?? 24, 1), 50);
  const searchExpression = queries
    .map((query) => `search=${encodeURIComponent(query)}`)
    .join("&");
  const products: ExternalProduct[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= maxPages; page++) {
    const url =
      `https://api.bestbuy.com/v1/products(${searchExpression})?format=json` +
      `&show=${encodeURIComponent(BESTBUY_SHOW)}&pageSize=${pageSize}&page=${page}` +
      `&apiKey=${encodeURIComponent(apiKey)}`;

    let payload: unknown;
    try {
      payload = await fetchJson<unknown>(url, { timeoutMs: 20_000 });
    } catch {
      break;
    }

    const items = extractItems(payload);
    if (items.length === 0) break;
    for (const item of items) {
      const externalId = firstString(item, ["sku", "id", "productId"]);
      const title = firstString(item, ["name", "title"]);
      const imageUrl =
        firstString(item, ["image", "thumbnailImage"]) ||
        firstString(asRecord(item.images)?.primary, ["src", "url", "href"]);
      const productUrl = firstString(item, ["url", "productUrl", "canonicalUrl"]);
      if (!externalId || seen.has(externalId)) continue;
      const product = toExternalProduct(
        "bestbuy",
        item,
        ctx,
        imageUrl,
        productUrl,
        title,
        externalId,
      );
      if (!product) continue;
      seen.add(externalId);
      products.push(product);
    }
  }

  return products;
}
