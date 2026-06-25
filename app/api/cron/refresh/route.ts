import { NextResponse } from "next/server";
import { getCronSecret } from "@/lib/sync/config";
import { executeScheduledSync } from "@/services/sync";
import { executeTrendingRefresh, isTrendingRefreshDue } from "@/services/trending";
import {
  executeLowestPriceRefresh,
  isLowestPriceRefreshDue,
} from "@/services/lowest-prices";
import { triggerPhase1Imports } from "@/services/sync";
import { runAliExpressScheduledSync } from "@/services/aliexpress";
import { runEbayScheduledSync } from "@/services/ebay";
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
  const force =
    url.searchParams.get("force") === "true" || request.headers.get("x-vercel-cron") === "1";
  const hourUtc = new Date().getUTCHours();
  const results: Record<string, unknown> = {};

  const sync = await executeScheduledSync();
  results.sync = sync.error
    ? { error: sync.error, results: sync.data }
    : { jobsRun: sync.data.length, results: sync.data };

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
    const aliexpress = await runAliExpressScheduledSync();
    results.aliexpress = aliexpress.skipped
      ? { skipped: true }
      : { jobsRun: aliexpress.results.length, results: aliexpress.results, error: aliexpress.error };

    const ebay = await runEbayScheduledSync();
    results.ebay = ebay.skipped
      ? { skipped: true }
      : { jobsRun: ebay.results.length, results: ebay.results, error: ebay.error };

    const imported = await triggerPhase1Imports();
    results.importPhase1 = imported.error
      ? { error: imported.error, results: imported.data }
      : { providersRun: imported.data.length, results: imported.data };
  } else {
    results.aliexpress = { skipped: true };
    results.ebay = { skipped: true };
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
