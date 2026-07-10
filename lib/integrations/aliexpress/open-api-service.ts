import {
  createAliExpressClientFromEnv,
  getAliExpressCredentialStatus,
} from "@/lib/integrations/aliexpress";
import type { AliExpressAffiliateClient } from "@/lib/integrations/aliexpress/client";
import { mapAliExpressRawToOpenApiProduct } from "@/lib/integrations/aliexpress/map-product";
import type { AliExpressOpenApiProduct } from "@/lib/integrations/aliexpress/open-api-types";
import type { AliExpressRawProduct } from "@/lib/integrations/aliexpress/types";
import { loadAliExpressCredentials } from "@/services/aliexpress/credentials";
import { logAliExpress } from "@/lib/integrations/aliexpress/logger";

export type AliExpressOpenApiSearchOptions = {
  limit?: number;
  pageNo?: number;
  pageSize?: number;
  currency?: string;
};

async function getOpenApiClient(): Promise<AliExpressAffiliateClient | null> {
  await loadAliExpressCredentials();
  const status = getAliExpressCredentialStatus();
  if (!status.configured) {
    logAliExpress("Open API client unavailable — APP_KEY/APP_SECRET missing");
    return null;
  }
  if (!status.hasTrackingId) {
    logAliExpress(
      "Open API warning — ALIEXPRESS_TRACKING_ID missing; affiliate links may be untracked",
    );
  }
  return createAliExpressClientFromEnv();
}

/**
 * Attach Open API promotion links using Tracking ID.
 * Falls back to product_detail_url when link.generate fails or returns nothing.
 */
export async function attachOpenApiAffiliateLinks(
  client: AliExpressAffiliateClient,
  products: AliExpressRawProduct[],
): Promise<AliExpressRawProduct[]> {
  if (products.length === 0) return products;

  const sourceUrls = products
    .map((p) => p.product_detail_url?.trim() || p.promotion_link?.trim() || "")
    .filter(Boolean);

  if (sourceUrls.length === 0) return products;

  try {
    const generated = await client.generatePromotionLinks(sourceUrls);
    return products.map((product) => {
      const source =
        product.product_detail_url?.trim() || product.promotion_link?.trim() || "";
      const link = source ? generated.get(source) : undefined;
      if (link) {
        return { ...product, promotion_link: link };
      }
      return product;
    });
  } catch (error) {
    logAliExpress("attachOpenApiAffiliateLinks failed — using product URLs", {
      message: error instanceof Error ? error.message : String(error),
      count: products.length,
    });
    return products;
  }
}

/** Official Open Platform product search + affiliate link generation. */
export async function searchAliExpressOpenApi(
  keywords: string,
  options?: AliExpressOpenApiSearchOptions,
): Promise<AliExpressOpenApiProduct[]> {
  const trimmed = keywords.trim();
  if (!trimmed) return [];

  const client = await getOpenApiClient();
  if (!client) return [];

  const limit = Math.min(Math.max(options?.limit ?? 24, 1), 50);
  const pageSize = Math.min(options?.pageSize ?? limit, 50);
  const pageNo = options?.pageNo ?? 1;
  const currency = options?.currency ?? "USD";

  try {
    const raw = await client.searchByKeyword(trimmed, {
      pageNo,
      pageSize,
      currency,
    });
    const withLinks = await attachOpenApiAffiliateLinks(client, raw.slice(0, limit));

    const mapped: AliExpressOpenApiProduct[] = [];
    for (const item of withLinks) {
      const product = mapAliExpressRawToOpenApiProduct(item);
      if (product) mapped.push(product);
      if (mapped.length >= limit) break;
    }
    return mapped;
  } catch (error) {
    logAliExpress("searchAliExpressOpenApi failed", {
      keywords: trimmed,
      message: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/** Official Open Platform product detail by product id. */
export async function getAliExpressOpenApiProduct(
  productId: string,
  currency = "USD",
): Promise<AliExpressOpenApiProduct | null> {
  const id = productId.replace(/^aliexpress-/, "").trim();
  if (!id) return null;

  const client = await getOpenApiClient();
  if (!client) return null;

  try {
    const raw = await client.getProductsByIds([id], currency);
    if (raw.length === 0) return null;
    const withLinks = await attachOpenApiAffiliateLinks(client, raw);
    return mapAliExpressRawToOpenApiProduct(withLinks[0] ?? raw[0]);
  } catch (error) {
    logAliExpress("getAliExpressOpenApiProduct failed", {
      productId: id,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function generateAliExpressOpenApiAffiliateLink(
  productUrl: string,
): Promise<string | null> {
  const url = productUrl.trim();
  if (!url) return null;

  const client = await getOpenApiClient();
  if (!client) return null;

  try {
    const links = await client.generatePromotionLinks([url]);
    return links.get(url) ?? null;
  } catch (error) {
    logAliExpress("generateAliExpressOpenApiAffiliateLink failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
