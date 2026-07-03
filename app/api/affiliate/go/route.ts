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
import { affiliateRateLimiter, enforceRateLimit } from "@/lib/security/api-rate-limit";
import { clampString } from "@/lib/security/input";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

/** Track click and redirect to the affiliate destination URL. */
export async function GET(request: Request) {
  const rateLimited = enforceRateLimit(request, affiliateRateLimiter);
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

  const affiliateUrl = await generateProductAffiliateUrl({
    destinationUrl,
    storeSlug,
    marketplace: marketplace as AffiliateMarketplace,
  });

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
