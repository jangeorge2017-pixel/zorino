import { NextResponse } from "next/server";
import { isEbayConfigured, isEbaySandboxMode, getEbayBrowseApiBase } from "@/lib/integrations/ebay/config";
import { isAliExpressConfigured } from "@/lib/integrations/aliexpress/config";
import { isAmazonConfigured } from "@/lib/integrations/amazon";
import { executeGlobalSearch } from "@/lib/search/engine";
import { hydrateIntegrationCredentials } from "@/lib/integration/credentials";

/**
 * Search provider health check — returns fetch counts per provider (no secrets).
 * Protected by CRON_SECRET when set.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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
