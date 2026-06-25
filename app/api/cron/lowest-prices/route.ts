import { NextResponse } from "next/server";
import { getCronSecret } from "@/lib/sync/config";
import { executeLowestPriceRefresh } from "@/services/lowest-prices";
import { invalidateLowestPricesFromRoute } from "@/lib/revalidate";

/** Cron: refresh lowest prices cache every ~4 hours. */
export async function GET(request: Request) {
  const secret = getCronSecret();
  const authHeader = request.headers.get("authorization");
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const force = url.searchParams.get("force") === "true";

  if (secret && authHeader !== `Bearer ${secret}` && querySecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
