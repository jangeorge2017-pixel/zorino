import { NextResponse } from "next/server";
import {
  generateProductAffiliateUrl,
  recordAffiliateClick,
} from "@/services/affiliate";
import {
  extractMarketplaceFromUrl,
  resolveMarketplace,
  type AffiliateMarketplace,
} from "@/lib/affiliate/config";
import { isAllowedAffiliateDestination } from "@/lib/affiliate/redirect-policy";
import { ADMITAD_TRACKING_HOSTS } from "@/lib/affiliate/redirect-policy";
import { affiliateRateLimiter, enforceRateLimit } from "@/lib/security/api-rate-limit";
import { clampString } from "@/lib/security/input";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

/** Track click and redirect to the affiliate destination URL. */
export async function GET(request: Request) {
  const rateLimited = await enforceRateLimit(request, affiliateRateLimiter);
  if (rateLimited) return rateLimited;

  const url = new URL(request.url);
  const productId = clampString(url.searchParams.get("productId") ?? undefined, 64);
  const storeSlug = clampString(url.searchParams.get("store") ?? undefined, 120);
  const destination = url.searchParams.get("to");
  const source = clampString(url.searchParams.get("source") ?? undefined, 64);
  const countryCode = clampString(url.searchParams.get("country") ?? undefined, 8);
  const sessionId = clampString(url.searchParams.get("sessionId") ?? undefined, 128);

  if (!destination) {
    return NextResponse.json({ error: "Missing destination URL" }, { status: 400 });
  }

  let destinationUrl: string;
  try {
    destinationUrl = decodeURIComponent(destination);
    new URL(destinationUrl);
  } catch {
    return NextResponse.json({ error: "Invalid destination URL" }, { status: 400 });
  }

  let storeWebsite: string | null = null;
  let storeId: string | null = null;
  if (storeSlug) {
    const supabase = createSupabaseServiceClient();
    if (supabase) {
      const { data } = await supabase
        .from("stores")
        .select("id, website")
        .eq("slug", storeSlug)
        .maybeSingle();
      storeId = (data as { id: string; website?: string } | null)?.id ?? null;
      storeWebsite = (data as { website?: string } | null)?.website ?? null;
    }
  }

  if (!isAllowedAffiliateDestination(destinationUrl, storeWebsite)) {
    return NextResponse.json({ error: "Destination not allowed" }, { status: 403 });
  }

  const marketplace =
    resolveMarketplace(storeSlug) ??
    extractMarketplaceFromUrl(destinationUrl) ??
    storeSlug ??
    "unknown";

  // Prefer an already-tracked destination to avoid double-wrapping affiliate URLs.
  let trackedHost = false;
  try {
    const destHost = new URL(destinationUrl).hostname.toLowerCase();
    trackedHost =
      ADMITAD_TRACKING_HOSTS.has(destHost) ||
      [...ADMITAD_TRACKING_HOSTS].some((h) => destHost.endsWith(`.${h}`)) ||
      destHost.endsWith(".admitad.com");
  } catch {
    trackedHost = false;
  }

  const alreadyTracked =
    trackedHost ||
    /([?&](tag|campid|aff_trace_key|aff_short_key|wmlspartner|customid)=)/i.test(
      destinationUrl,
    ) || /s\.click\.aliexpress\.com/i.test(destinationUrl)
    || /s\.noon\.com/i.test(destinationUrl);

  let affiliateUrl: string;
  if (alreadyTracked) {
    affiliateUrl = destinationUrl;
  } else if (marketplace === "admitad" || marketplace === "alibaba") {
    // Admitad programs: generate a REAL deeplink through the Admitad API when
    // the destination belongs to a discovered deeplink-capable program.
    // Falls back to the allowlisted merchant destination itself — never a
    // fabricated tracking URL.
    const { generateAdmitadDeeplinkForDestination } = await import(
      "@/lib/integrations/admitad/merchant-discovery"
    );
    affiliateUrl =
      (await generateAdmitadDeeplinkForDestination(destinationUrl)) ?? destinationUrl;
  } else {
    // Do NOT pass the raw destination as promotionLink/affiliateUrl — the
    // AliExpress/eBay generators short-circuit on that field and would return
    // it untracked. Let them build real tracked URLs.
    affiliateUrl = await generateProductAffiliateUrl({
      destinationUrl,
      storeSlug,
      marketplace: marketplace as AffiliateMarketplace,
    });
  }

  // NOTE: No server-side network request is made for the destination URL here.
  // The destination was validated above (protocol + host policy) and is only
  // used to build the client-side redirect below. Affiliate/deeplink generation
  // already falls back to the validated destination when it cannot produce a
  // real tracked URL, so no liveness revalidation is required — and performing
  // a HEAD request against a user-influenced URL would create a request-forgery
  // (SSRF) sink.

  await recordAffiliateClick({
    productId,
    storeId,
    marketplace,
    destinationUrl,
    affiliateUrl,
    sessionId,
    countryCode,
    source,
    referrer: request.headers.get("referer"),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.redirect(affiliateUrl, 302);
}
