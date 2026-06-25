import { buildAffiliateUrl } from "@/lib/affiliate/generate";
import {
  createEbayClientFromEnv,
  getEbayCredentials,
  isEbayConfigured,
} from "@/lib/integrations/ebay";
import { loadEbayCredentials } from "@/services/ebay/credentials";
import { logEbayImportEvent } from "@/services/ebay/monitoring";

export type EbayAffiliateLinkInput = {
  productUrl: string;
  affiliateUrl?: string | null;
  trackingId?: string;
};

export type EbayAffiliateLinkResult = {
  url: string;
  source: "api" | "affiliate_url" | "fallback";
};

/** Generate a tracked eBay affiliate URL (API affiliate URL first, no mock data). */
export async function generateEbayAffiliateLink(
  input: EbayAffiliateLinkInput
): Promise<EbayAffiliateLinkResult> {
  if (input.affiliateUrl?.trim()) {
    return { url: input.affiliateUrl.trim(), source: "affiliate_url" };
  }

  await loadEbayCredentials();

  if (isEbayConfigured()) {
    const creds = getEbayCredentials();
    const client = createEbayClientFromEnv();
    if (client && creds?.campaignId) {
      try {
        const itemId = extractEbayItemId(input.productUrl);
        if (itemId) {
          const items = await client.getItemsByIds([itemId], "US");
          const affiliateUrl = items[0]?.itemAffiliateWebUrl?.trim();
          if (affiliateUrl) {
            return { url: affiliateUrl, source: "api" };
          }
        }
      } catch (err) {
        await logEbayImportEvent({
          jobType: "affiliate_link",
          level: "warn",
          message: err instanceof Error ? err.message : "Affiliate URL lookup failed",
          metadata: { productUrl: input.productUrl },
        });
      }
    }
  }

  const fallback = buildAffiliateUrl({
    destinationUrl: input.productUrl,
    marketplace: "ebay",
    partnerTag: getEbayCredentials()?.campaignId ?? undefined,
    trackingId: input.trackingId,
  });

  return { url: fallback, source: "fallback" };
}

export async function generateEbayAffiliateLinks(
  inputs: EbayAffiliateLinkInput[]
): Promise<Map<string, EbayAffiliateLinkResult>> {
  const results = new Map<string, EbayAffiliateLinkResult>();

  for (const input of inputs) {
    const result = await generateEbayAffiliateLink(input);
    results.set(input.productUrl, result);
  }

  return results;
}

function extractEbayItemId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathMatch = parsed.pathname.match(/\/itm\/(\d+)/);
    if (pathMatch?.[1]) return pathMatch[1];
    const legacy = parsed.searchParams.get("item");
    return legacy?.trim() || null;
  } catch {
    return null;
  }
}
