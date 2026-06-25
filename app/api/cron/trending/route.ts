import { NextResponse } from "next/server";
import { getCronSecret } from "@/lib/sync/config";
import { executeTrendingRefresh, isTrendingRefreshDue } from "@/services/trending";
import { invalidateTrendingFromRoute } from "@/lib/revalidate";

/**
 * Cron endpoint — recomputes trending rankings every ~4 hours.
 * Vercel cron example: schedule every 4 hours on /api/cron/trending
 */
export async function GET(request: Request) {
  const secret = getCronSecret();
  const authHeader = request.headers.get("authorization");
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const force = url.searchParams.get("force") === "true";

  if (secret && authHeader !== `Bearer ${secret}` && querySecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!force) {
    const due = await isTrendingRefreshDue();
    if (!due) {
      return NextResponse.json({ success: true, skipped: true, message: "Not due yet" });
    }
  }

  const result = await executeTrendingRefresh();

  if (result.error) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  }

  invalidateTrendingFromRoute();

  return NextResponse.json({
    success: true,
    itemsRanked: result.ranked,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
