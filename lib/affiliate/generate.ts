import {
  AFFILIATE_ENV_KEYS,
  type AffiliateMarketplace,
  extractMarketplaceFromUrl,
  resolveMarketplace,
} from "@/lib/affiliate/config";

export type AffiliatePartnerConfig = {
  marketplace: AffiliateMarketplace;
  partnerTag: string | null;
  commissionRate: number;
  isEnabled: boolean;
};

export type BuildAffiliateUrlInput = {
  destinationUrl: string;
  marketplace?: AffiliateMarketplace | null;
  storeSlug?: string | null;
  partnerTag?: string | null;
  trackingId?: string;
};

/** Build a marketplace-specific affiliate URL with partner tracking parameters. */
export function buildAffiliateUrl(input: BuildAffiliateUrlInput): string {
  const marketplace =
    input.marketplace ??
    resolveMarketplace(input.storeSlug) ??
    extractMarketplaceFromUrl(input.destinationUrl);

  if (!marketplace) return input.destinationUrl;

  const tag =
    input.partnerTag?.trim() ||
    getPartnerTagFromEnv(marketplace) ||
    `zorino-${marketplace}`;

  const trackingId = input.trackingId ?? generateTrackingToken();

  try {
    const url = new URL(input.destinationUrl);

    switch (marketplace) {
      case "amazon":
        url.searchParams.set("tag", tag);
        break;
      case "aliexpress":
        url.searchParams.set("aff_platform", "api-new");
        url.searchParams.set("aff_trace_key", tag);
        url.searchParams.set("dp", trackingId.slice(0, 12));
        break;
      case "ebay":
        url.searchParams.set("campid", tag);
        url.searchParams.set("customid", trackingId);
        break;
      case "walmart":
        url.searchParams.set("wmlspartner", tag);
        url.searchParams.set("sourceid", trackingId.slice(0, 16));
        break;
      case "temu":
        url.searchParams.set("ref", tag);
        url.searchParams.set("_p_rfs", trackingId.slice(0, 12));
        break;
    }

    url.searchParams.set("zorino_ref", trackingId);
    return url.toString();
  } catch {
    return input.destinationUrl;
  }
}

export function getPartnerTagFromEnv(marketplace: AffiliateMarketplace): string | null {
  for (const key of AFFILIATE_ENV_KEYS[marketplace]) {
    const val = process.env[key]?.trim();
    if (val) return val;
  }
  return null;
}

export function generateTrackingToken(): string {
  return `z_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Client-safe redirect URL through the affiliate tracking endpoint. */
export function buildAffiliateRedirectPath(input: {
  productId: string;
  storeSlug: string;
  destinationUrl: string;
  source?: string;
  countryCode?: string;
}): string {
  const params = new URLSearchParams({
    productId: input.productId,
    store: input.storeSlug,
    to: input.destinationUrl,
  });
  if (input.source) params.set("source", input.source);
  if (input.countryCode) params.set("country", input.countryCode);
  return `/api/affiliate/go?${params.toString()}`;
}
