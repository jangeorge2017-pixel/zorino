import { extractMarketplaceFromUrl } from "@/lib/affiliate/config";

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

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
    if (storeWebsite && hostnameMatchesStoreWebsite(destinationUrl, storeWebsite)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
