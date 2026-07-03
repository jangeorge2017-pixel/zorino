import { NextResponse } from "next/server";
import { authorizeCronRequest, cronUnauthorizedResponse } from "@/lib/security/cron-auth";
import { executeTrendingRefresh, isTrendingRefreshDue } from "@/services/trending";
import { invalidateTrendingFromRoute } from "@/lib/revalidate";

/** Cron endpoint — recomputes trending rankings every ~4 hours. */
export async function GET(request: Request) {
  if (!authorizeCronRequest(request)) {
    return cronUnauthorizedResponse();
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";

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
