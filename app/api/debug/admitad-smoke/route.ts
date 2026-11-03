import { NextResponse } from "next/server";

import { runAdmitadIngestion } from "@/lib/integrations/admitad";
import { authorizeCronRequest, cronUnauthorizedResponse } from "@/lib/security/cron-auth";
import { runSyncJob } from "@/lib/sync/engine";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!authorizeCronRequest(request)) {
    return cronUnauthorizedResponse();
  }

  const provider = new URL(request.url).searchParams.get("provider");
  if (provider === "ebay") {
    const supabase = createSupabaseServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase unavailable" }, { status: 503 });
    }
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, slug, integration_type")
      .eq("slug", "ebay")
      .maybeSingle<{ id: string; slug: string; integration_type: string }>();
    if (storeError || !store) {
      return NextResponse.json({ error: storeError?.message ?? "eBay store missing" }, { status: 500 });
    }

    const result = await runSyncJob(
      {
        storeId: store.id,
        storeSlug: store.slug,
        integrationType: "ebay",
        countryCode: "US",
        currency: "USD",
        jobType: "products",
        jobConfig: { keywords: ["iphone"], maxPages: 1, pageSize: 1 },
      },
      { persist: true },
    );

    const { data: offers } = await supabase
      .from("product_offers")
      .select("product_id, store_name, network_name, country_code, price, currency, affiliate_url")
      .eq("store_name", "eBay")
      .order("last_updated", { ascending: false })
      .limit(1)
      .returns<{ product_id: string; store_name: string; network_name: string; country_code: string; price: number; currency: string; affiliate_url: string }[]>();
    const offer = offers?.[0] ?? null;

    const { data: product } = offer
      ? await supabase
          .from("products")
          .select("id, global_sku, title, main_image, barcode")
          .eq("id", offer.product_id)
          .maybeSingle<{ id: string; global_sku: string; title: string; main_image: string; barcode: string }>()
      : { data: null };

    return NextResponse.json({ result, offer, product });
  }

  const result = await runAdmitadIngestion({
    maxFeeds: 1,
    maxProductsPerFeed: 2,
    deadlineMs: 30_000,
  });

  return NextResponse.json(result);
}
