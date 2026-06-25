import { NextResponse } from "next/server";
import { getCronSecret } from "@/lib/sync/config";
import { executeTrendingRefresh, isTrendingRefreshDue } from "@/services/trending";
import {
  executeLowestPriceRefresh,
  isLowestPriceRefreshDue,
} from "@/services/lowest-prices";
import { triggerPhase1Imports } from "@/services/sync";
import { runNotificationAlerts } from "@/services/notifications/alerts";
import { invalidateLowestPricesFromRoute, invalidateTrendingFromRoute } from "@/lib/revalidate";

function authorize(request: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return true;
  const authHeader = request.headers.get("authorization");
  const url = new URL(request.url);
  return authHeader === `Bearer ${secret}` || url.searchParams.get("secret") === secret;
}

/** Bundled maintenance cron — keeps Vercel Hobby plan within the 2-cron limit. */
export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";
  const hourUtc = new Date().getUTCHours();
  const results: Record<string, unknown> = {};

  if (force || (await isTrendingRefreshDue())) {
    const trending = await executeTrendingRefresh();
    results.trending = trending.error
      ? { error: trending.error }
      : { itemsRanked: trending.ranked ?? 0 };
    if (!trending.error) invalidateTrendingFromRoute();
  } else {
    results.trending = { skipped: true };
  }

  const lowest = await executeLowestPriceRefresh({
    force,
    triggeredBy: "cron",
  });
  results.lowestPrices =
    "error" in lowest && lowest.error
      ? { error: lowest.error }
      : { skipped: lowest.skipped, itemsComputed: lowest.itemsComputed };
  if (!lowest.skipped && !("error" in lowest && lowest.error)) invalidateLowestPricesFromRoute();

  if (force || hourUtc % 6 === 0) {
    const imported = await triggerPhase1Imports();
    results.importPhase1 = imported.error
      ? { error: imported.error, results: imported.data }
      : { providersRun: imported.data.length, results: imported.data };
  } else {
    results.importPhase1 = { skipped: true };
  }

  if (force || hourUtc === 8) {
    results.notifications = await runNotificationAlerts();
  } else {
    results.notifications = { skipped: true };
  }

  return NextResponse.json({ success: true, results });
}

export async function POST(request: Request) {
  return GET(request);
}
