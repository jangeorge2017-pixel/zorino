import { extractMarketplaceFromUrl } from "@/lib/affiliate/config";

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

/**
 * Admitad goto/tracking domains.
 *
 * Admitad rewrites program affiliate links to white-label tracking domains
 * (`https://<domain>/g/<token>/...`). These are real, already-tracked affiliate
 * destinations collected from the publisher registry and the ingested product
 * feeds (lowest_prices_today.affiliate_url). Redirecting users to them is the
 * whole point of the affiliate flow.
 */
export const ADMITAD_TRACKING_HOSTS = new Set([
  "ad.admitad.com",
  "rzekl.com", // Alibaba WW (+ others)
  "bywiola.com",
  "dorinebeaumont.com",
  "lsuix.com",
  "tjzuh.com",
  "ujhjj.com",
  "xnmik.com",
  "qwpeg.com",
  "codeaven.com",
  "ficca2021.com",
  "xpuvo.com",
  "xcdus.com",
  "xmknb.com",
  "yyczo.com",
  "zmgig.com",
  "grfpr.com",
  "axavl.com",
  "zejcl.com",
  "plrvq.com",
  // Registry programs whose tracking hosts were missing from this allowlist
  // (go-route rejected their destinations with 403):
  "yknhe.com", // Cheapvuelos
  "naiawork.com", // MyHeritage DNA
  "rcpsj.com", // Aovica
  "xnmk.com", // AbeBooks (distinct from legacy xnmik.com above)
  "wbbsv.com", // Touch (UA)
  "sgkaa.com", // Miravia (ES/PT)
  "cafxq.com", // Funko (EU)
]);

/**
 * Alibaba storefronts served through Admitad programs (Alibaba WW deep links
 * land on offer.alibaba.com / alibaba.com product pages).
 */
const ADMITAD_PROGRAM_DESTINATION_HOSTS = new Set([
  "alibaba.com",
  "offer.alibaba.com",
]);

function isAdmitadTrackingHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "admitad.com" || host.endsWith(".admitad.com")) return true;
  if (ADMITAD_TRACKING_HOSTS.has(host)) return true;
  for (const tracked of ADMITAD_TRACKING_HOSTS) {
    if (host.endsWith(`.${tracked}`)) return true;
  }
  return false;
}

function isAdmitadProgramDestination(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    ADMITAD_PROGRAM_DESTINATION_HOSTS.has(host) ||
    [...ADMITAD_PROGRAM_DESTINATION_HOSTS].some((h) => host.endsWith(`.${h}`))
  );
}

export function isSafeRedirectProtocol(protocol: string): boolean {
  return protocol === "http:" || protocol === "https:";
}

export function isBlockedRedirectHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith(".local")) return true;
  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    return true;
  }
  return false;
}

export function isKnownMarketplaceDestination(url: string): boolean {
  return extractMarketplaceFromUrl(url) !== null;
}

export function hostnameMatchesStoreWebsite(
  destinationUrl: string,
  storeWebsite: string,
): boolean {
  try {
    const destHost = new URL(destinationUrl).hostname.toLowerCase();
    const storeHost = new URL(storeWebsite).hostname.toLowerCase();
    return destHost === storeHost || destHost.endsWith(`.${storeHost}`);
  } catch {
    return false;
  }
}

export function isAllowedAffiliateDestination(
  destinationUrl: string,
  storeWebsite?: string | null,
): boolean {
  try {
    const parsed = new URL(destinationUrl);
    if (!isSafeRedirectProtocol(parsed.protocol)) return false;
    if (isBlockedRedirectHost(parsed.hostname)) return false;
    if (isKnownMarketplaceDestination(destinationUrl)) return true;
    // Admitad goto/tracking links and Alibaba program destinations are valid,
    // already-tracked affiliate destinations.
    if (isAdmitadTrackingHost(parsed.hostname)) return true;
    if (isAdmitadProgramDestination(parsed.hostname)) return true;
    if (storeWebsite && hostnameMatchesStoreWebsite(destinationUrl, storeWebsite)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
