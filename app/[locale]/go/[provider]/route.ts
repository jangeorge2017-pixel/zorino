import { NextResponse } from "next/server";
import { extractMarketplaceFromUrl } from "@/lib/affiliate/config";
import { isAllowedAffiliateDestination } from "@/lib/affiliate/redirect-policy";
import { parseAffiliateDestinationParam } from "@/lib/affiliate/product-url";
import { STORE_BASE_URLS } from "@/lib/integrations/egypt-stores/affiliate";
import {
  PROVIDER_STORE_META,
  isRegisteredProvider,
  resolveProviderId,
} from "@/lib/providers/registry";
import { clampString } from "@/lib/security/input";

type RouteContext = { params: Promise<{ locale: string; provider: string }> };

function hostnameOf(raw: string): string | null {
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function hostMatches(host: string, expected: string): boolean {
  return host === expected || host.endsWith(`.${expected}`);
}

/**
 * True when `destination` belongs to the store named by the `provider` segment.
 * Marketplace ids delegate to the shared marketplace extractor; the Egyptian
 * storefronts (which have no marketplace program id) match their canonical
 * base host.
 */
function providerAllowsDestination(
  providerId: string,
  destination: string,
): boolean {
  const host = hostnameOf(destination);
  if (!host) return false;

  const marketplace = extractMarketplaceFromUrl(destination);
  if (marketplace === providerId) return true;

  const storeWebsite = PROVIDER_STORE_META[providerId]?.website;
  const storeHost = storeWebsite ? hostnameOf(storeWebsite) : null;
  if (storeHost && hostMatches(host, storeHost)) return true;

  const egyptBase = STORE_BASE_URLS[providerId];
  const egyptHost = egyptBase ? hostnameOf(egyptBase) : null;
  if (egyptHost && hostMatches(host, egyptHost)) return true;

  return false;
}

/**
 * Compatibility redirect for outbound links that use the localized
 * `/<locale>/go/<provider>?url=<product-url>` shape.
 *
 * The destination is validated against the same storefront allowlist as
 * `/api/affiliate/go`, then handed to that route so affiliate/tracking and
 * click recording stay in exactly one place.
 */
export async function GET(request: Request, context: RouteContext) {
  const { provider } = await context.params;
  const requestedProvider = clampString(provider, 120) ?? "";
  const providerId = resolveProviderId(requestedProvider);

  if (!isRegisteredProvider(providerId)) {
    return NextResponse.json(
      { error: `Unknown redirect provider: ${requestedProvider}` },
      { status: 404 },
    );
  }

  const url = new URL(request.url);
  const rawDestination =
    url.searchParams.get("url") ??
    url.searchParams.get("to") ??
    url.searchParams.get("target");
  const destination = parseAffiliateDestinationParam(rawDestination);
  if (!destination) {
    return NextResponse.json(
      { error: "Missing or invalid destination URL" },
      { status: 400 },
    );
  }

  const storeWebsite = PROVIDER_STORE_META[providerId]?.website ?? null;
  if (
    !isAllowedAffiliateDestination(destination, storeWebsite) ||
    !providerAllowsDestination(providerId, destination)
  ) {
    return NextResponse.json({ error: "Destination not allowed" }, { status: 403 });
  }

  const params = new URLSearchParams({ to: destination, store: providerId });

  const productId = clampString(url.searchParams.get("productId") ?? undefined, 64);
  const source = clampString(url.searchParams.get("source") ?? undefined, 64);
  const country = clampString(url.searchParams.get("country") ?? undefined, 8);
  const sessionId = clampString(url.searchParams.get("sessionId") ?? undefined, 128);
  if (productId) params.set("productId", productId);
  if (source) params.set("source", source);
  if (country) params.set("country", country);
  if (sessionId) params.set("sessionId", sessionId);

  // Relative Location: behind Render's proxy `request.url` is the internal
  // origin (localhost:10000), so an absolute URL would redirect users there.
  return new Response(null, {
    status: 302,
    headers: { Location: `/api/affiliate/go?${params.toString()}` },
  });
}
