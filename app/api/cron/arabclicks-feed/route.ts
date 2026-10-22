import { NextResponse } from "next/server";
import { authorizeCronRequest, cronUnauthorizedResponse } from "@/lib/security/cron-auth";
import { runArabClicksFeedIngestion } from "@/lib/integration/arabclicks-feed";
import { invalidateLowestPricesFromRoute } from "@/lib/revalidate";

/**
 * Manual / dry-run runner for the ArabClicks universal product feed.
 *
 * Not a scheduled Vercel cron — the bundled `/api/cron/refresh` already carries
 * the feed step (behind ARABCLICKS_FEED_SYNC_ENABLED). This route exists so ops
 * can validate the feed without flipping the production switch:
 *
 *   GET /api/cron/arabclicks-feed?dryRun=true&maxItems=1000
 *   GET /api/cron/arabclicks-feed?force=true&dryRun=false&maxItems=1000
 *
 * `force` bypasses the enable flag (manual runs only); a non-dry run writes
 * products/offers and refreshes the lowest-prices cache.
 */
export const maxDuration = 60;

const TRUTHY = new Set(["1", "true", "yes", "on"]);
const FALSY = new Set(["0", "false", "no", "off"]);

function parseBool(raw: string | null): boolean | undefined {
  if (raw == null) return undefined;
  const value = raw.trim().toLowerCase();
  if (TRUTHY.has(value)) return true;
  if (FALSY.has(value)) return false;
  return undefined;
}

export async function GET(request: Request) {
  if (!authorizeCronRequest(request)) {
    return cronUnauthorizedResponse();
  }

  const url = new URL(request.url);
  const maxItemsRaw = Number.parseInt(url.searchParams.get("maxItems") ?? "", 10);
  const budgetRaw = Number.parseInt(url.searchParams.get("budgetMs") ?? "", 10);
  const budgetMs = Number.isFinite(budgetRaw)
    ? Math.min(Math.max(budgetRaw, 5_000), 55_000)
    : 50_000;

  const result = await runArabClicksFeedIngestion({
    dryRun: parseBool(url.searchParams.get("dryRun")),
    maxItems: Number.isFinite(maxItemsRaw) ? maxItemsRaw : undefined,
    force: url.searchParams.get("force") === "true",
    deadlineMs: Date.now() + budgetMs,
  });

  if (!result.dryRun && !result.skipped && !result.error) {
    invalidateLowestPricesFromRoute();
  }

  return NextResponse.json(
    { success: !result.error, ...result },
    { status: result.error ? 502 : 200 },
  );
}

export async function POST(request: Request) {
  return GET(request);
}
