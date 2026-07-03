import { NextResponse } from "next/server";
import { authorizeCronRequest, cronUnauthorizedResponse } from "@/lib/security/cron-auth";
import { executeLowestPriceRefresh } from "@/services/lowest-prices";
import { invalidateLowestPricesFromRoute } from "@/lib/revalidate";

/** Cron: refresh lowest prices cache every ~4 hours. */
export async function GET(request: Request) {
  if (!authorizeCronRequest(request)) {
    return cronUnauthorizedResponse();
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";

  const result = await executeLowestPriceRefresh({
    force,
    triggeredBy: "cron",
  });

  if ("error" in result && result.error) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  }

  if (!result.skipped) {
    invalidateLowestPricesFromRoute();
  }

  return NextResponse.json({
    success: true,
    skipped: result.skipped,
    itemsComputed: result.itemsComputed,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
