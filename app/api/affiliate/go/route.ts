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
import { createSupabaseServiceClient } from "@/lib/supabase/server";

/** Track click and redirect to the affiliate destination URL. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  const storeSlug = url.searchParams.get("store");
  const destination = url.searchParams.get("to");
  const source = url.searchParams.get("source");
  const countryCode = url.searchParams.get("country");
  const sessionId = url.searchParams.get("sessionId");

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

  const marketplace =
    resolveMarketplace(storeSlug) ?? extractMarketplaceFromUrl(destinationUrl) ?? storeSlug ?? "unknown";

  const affiliateUrl = await generateProductAffiliateUrl({
    destinationUrl,
    storeSlug,
    marketplace: marketplace as AffiliateMarketplace,
  });

  let storeId: string | null = null;
  if (storeSlug) {
    const supabase = createSupabaseServiceClient();
    if (supabase) {
      const { data } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", storeSlug)
        .maybeSingle();
      storeId = (data as { id: string } | null)?.id ?? null;
    }
  }

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
