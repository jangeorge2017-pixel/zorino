import { NextResponse } from "next/server";
import { hydrateIntegrationCredentials } from "@/lib/integration/credentials";
import { getAliExpressCredentialStatus } from "@/lib/integrations/aliexpress/config";
import { isEbayConfigured } from "@/lib/integrations/ebay/config";
import { isAmazonConfigured } from "@/lib/integrations/amazon";
import { searchAliExpressOpenApi } from "@/lib/integrations/aliexpress/open-api-service";

export const maxDuration = 60;

/**
 * Runtime integration status (booleans only — never returns secrets).
 * Optional ?probe=1&q=keywords runs a live Open API search and reports field presence.
 */
export async function GET(request: Request) {
  await hydrateIntegrationCredentials();

  const ae = getAliExpressCredentialStatus();
  const url = new URL(request.url);
  const probe = url.searchParams.get("probe") === "1";
  const query = url.searchParams.get("q")?.trim() || "wireless earbuds";

  const body: Record<string, unknown> = {
    ok: true,
    credentials: {
      aliexpress: {
        configured: ae.configured,
        hasAppKey: ae.hasAppKey,
        hasAppSecret: ae.hasAppSecret,
        hasTrackingId: ae.hasTrackingId,
        source: ae.source,
      },
      ebay: { configured: isEbayConfigured() },
      amazon: { configured: isAmazonConfigured() },
    },
  };

  if (!probe) {
    return NextResponse.json(body);
  }

  if (!ae.configured) {
    return NextResponse.json({
      ...body,
      probe: {
        ok: false,
        query,
        productCount: 0,
        error: "AliExpress Open Platform credentials are not configured",
      },
    });
  }

  try {
    const products = await searchAliExpressOpenApi(query, { limit: 8 });
    const sample = products[0];
    body.probe = {
      ok: products.length > 0,
      query,
      productCount: products.length,
      sample: sample
        ? {
            hasTitle: Boolean(sample.title),
            hasImage: Boolean(sample.image?.startsWith("http")),
            hasCurrentPrice: sample.currentPrice > 0,
            hasOriginalPrice: sample.originalPrice > 0,
            hasDiscount: sample.discount >= 0,
            hasRating: sample.rating >= 0,
            hasSalesCount: sample.salesCount >= 0,
            hasShipping: Boolean(sample.shipping),
            hasStoreName: Boolean(sample.storeName),
            hasAffiliateUrl: Boolean(sample.affiliateUrl?.startsWith("http")),
            affiliateIsTracked: /s\.click\.aliexpress\.com/i.test(sample.affiliateUrl),
            shipping: sample.shipping,
            storeName: sample.storeName,
          }
        : null,
      error: null,
    };
  } catch (error) {
    body.probe = {
      ok: false,
      query,
      productCount: 0,
      sample: null,
      error: error instanceof Error ? error.message : "AliExpress probe failed",
    };
  }

  return NextResponse.json(body);
}
