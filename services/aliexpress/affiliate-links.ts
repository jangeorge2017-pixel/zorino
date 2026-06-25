import { buildAffiliateUrl } from "@/lib/affiliate/generate";
import {
  AliExpressAffiliateClient,
  createAliExpressClientFromEnv,
  isAliExpressConfigured,
} from "@/lib/integrations/aliexpress";
import { loadAliExpressCredentials } from "@/services/aliexpress/credentials";
import { logImportEvent } from "@/services/aliexpress/monitoring";

export type AffiliateLinkInput = {
  productUrl: string;
  promotionLink?: string | null;
  trackingId?: string;
};

export type AffiliateLinkResult = {
  url: string;
  source: "api" | "promotion_link" | "fallback";
};

/** Generate a tracked AliExpress affiliate URL (API-first, no mock data). */
export async function generateAliExpressAffiliateLink(
  input: AffiliateLinkInput
): Promise<AffiliateLinkResult> {
  if (input.promotionLink?.trim()) {
    return { url: input.promotionLink.trim(), source: "promotion_link" };
  }

  await loadAliExpressCredentials();

  if (isAliExpressConfigured()) {
    const client = createAliExpressClientFromEnv();
    if (client) {
      try {
        const links = await client.generatePromotionLinks([input.productUrl]);
        const generated = links.get(input.productUrl);
        if (generated) {
          return { url: generated, source: "api" };
        }
      } catch (err) {
        await logImportEvent({
          jobType: "affiliate_link",
          level: "warn",
          message: err instanceof Error ? err.message : "Link generate API failed",
          metadata: { productUrl: input.productUrl },
        });
      }
    }
  }

  const fallback = buildAffiliateUrl({
    destinationUrl: input.productUrl,
    marketplace: "aliexpress",
    trackingId: input.trackingId,
  });

  return { url: fallback, source: "fallback" };
}

export async function generateAliExpressAffiliateLinks(
  inputs: AffiliateLinkInput[]
): Promise<Map<string, AffiliateLinkResult>> {
  const results = new Map<string, AffiliateLinkResult>();
  if (inputs.length === 0) return results;

  await loadAliExpressCredentials();
  const client = createAliExpressClientFromEnv();

  const needsApi: string[] = [];
  for (const input of inputs) {
    if (input.promotionLink?.trim()) {
      results.set(input.productUrl, {
        url: input.promotionLink.trim(),
        source: "promotion_link",
      });
    } else {
      needsApi.push(input.productUrl);
    }
  }

  if (client && needsApi.length > 0) {
    try {
      const generated = await client.generatePromotionLinks(needsApi);
      for (const url of needsApi) {
        const link = generated.get(url);
        if (link) {
          results.set(url, { url: link, source: "api" });
        }
      }
    } catch {
      // fall through to per-item fallback
    }
  }

  for (const input of inputs) {
    if (results.has(input.productUrl)) continue;
    const fallback = await generateAliExpressAffiliateLink(input);
    results.set(input.productUrl, fallback);
  }

  return results;
}