import {
  getEbayCredentials,
  getEbayTokenUrl,
} from "@/lib/integrations/ebay/config";

const TOKEN_CACHE_KEY = "__zorino_ebay_token__";

type CachedToken = { accessToken: string; expiresAt: number };

function getTokenCache(): CachedToken | null {
  const g = globalThis as typeof globalThis & { [TOKEN_CACHE_KEY]?: CachedToken };
  const cached = g[TOKEN_CACHE_KEY];
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached;
  return null;
}

function setTokenCache(accessToken: string, expiresInSec: number): string {
  const g = globalThis as typeof globalThis & { [TOKEN_CACHE_KEY]?: CachedToken };
  g[TOKEN_CACHE_KEY] = {
    accessToken,
    expiresAt: Date.now() + expiresInSec * 1000,
  };
  return accessToken;
}

/** Obtain eBay application access token via client credentials grant. */
export async function getEbayAccessToken(): Promise<string> {
  const creds = getEbayCredentials();
  if (creds?.oauthToken?.trim()) return creds.oauthToken.trim();

  const cached = getTokenCache();
  if (cached) return cached.accessToken;

  if (!creds?.appId || !creds?.certId) {
    throw new Error("EBAY_APP_ID and EBAY_CERT_ID are required for eBay OAuth");
  }

  const credentials = Buffer.from(`${creds.appId}:${creds.certId}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "https://api.ebay.com/oauth/api_scope",
  });

  const res = await fetch(getEbayTokenUrl(), {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`eBay OAuth failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = JSON.parse(text) as { access_token: string; expires_in: number };
  return setTokenCache(json.access_token, json.expires_in ?? 7200);
}

export function ebayMarketplaceId(countryCode: string): string {
  const map: Record<string, string> = {
    US: "EBAY_US",
    GB: "EBAY_GB",
    DE: "EBAY_DE",
    AU: "EBAY_AU",
    CA: "EBAY_CA",
  };
  return map[countryCode.toUpperCase()] ?? "EBAY_US";
}

/** Build affiliate context header for eBay Partner Network tracked URLs. */
export function buildEbayAffiliateContext(campaignId?: string, referenceId?: string): string | null {
  const camp = campaignId?.trim();
  if (!camp) return null;

  const parts = [`affiliateCampaignId=${camp}`];
  if (referenceId?.trim()) {
    parts.push(`affiliateReferenceId=${referenceId.trim()}`);
  }
  return parts.join(",");
}
