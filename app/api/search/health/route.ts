import { NextResponse } from "next/server";
import { isEbayConfigured, isEbaySandboxMode, getEbayBrowseApiBase } from "@/lib/integrations/ebay/config";
import { isAliExpressConfigured } from "@/lib/integrations/aliexpress/config";
import { isAmazonConfigured } from "@/lib/integrations/amazon";
import { executeGlobalSearch } from "@/lib/search/engine";
import { hydrateIntegrationCredentials } from "@/lib/integration/credentials";
import { authorizeCronRequest, cronUnauthorizedResponse } from "@/lib/security/cron-auth";

/**
 * Search provider health check — returns fetch counts per provider (no secrets).
 * Always protected the same way as /api/cron/* (Bearer CRON_SECRET).
 */
export async function GET(request: Request) {
  if (!authorizeCronRequest(request)) {
    return cronUnauthorizedResponse();
  }

  await hydrateIntegrationCredentials();

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() || "iPhone 16";

  const result = await executeGlobalSearch(query, { limit: 50, skipCache: true });

  const offerCounts = { ebay: 0, aliexpress: 0, amazon: 0, other: 0 };
  for (const product of result.products) {
    for (const offer of product.offers) {
      if (offer.providerId === "ebay") offerCounts.ebay++;
      else if (offer.providerId === "aliexpress") offerCounts.aliexpress++;
      else if (offer.providerId === "amazon") offerCounts.amazon++;
      else offerCounts.other++;
    }
  }

  return NextResponse.json({
    ok: true,
    query,
    credentials: {
      ebay: {
        configured: isEbayConfigured(),
        sandboxMode: isEbaySandboxMode(),
        browseApi: getEbayBrowseApiBase(),
      },
      aliexpress: { configured: isAliExpressConfigured() },
      amazon: { configured: isAmazonConfigured() },
    },
    search: {
      totalFetched: result.totalFetched,
      totalUnified: result.totalUnified,
      offerCounts,
      providers: result.providers.map((p) => ({
        id: p.providerId,
        fetched: p.fetched,
        durationMs: p.durationMs,
        error: p.error ?? null,
      })),
    },
  });
}
