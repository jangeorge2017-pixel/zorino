import { NextRequest, NextResponse } from "next/server";
import { getSearchResultsPage } from "@/lib/data/homepage";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";
import { type CurrencyCode } from "@/lib/international/config";
import { resolveCurrencyForRequest, detectCountryFromHeaders } from "@/lib/international/detect";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const limit = Number(
    url.searchParams.get("limit") ?? SEARCH_ENGINE_DEFAULTS.PAGE_SIZE
  );
  const sortRaw = url.searchParams.get("sort") ?? "relevance";
  const sort = sortRaw === "price" || sortRaw === "price_low" ? "price" : "relevance";
  // Visitor's ACTIVE currency: cookie > geo-detected country default. Mirrors
  // the /search page so the strict device floor and the display seam speak the
  // same currency the rendered page uses.
  const country = detectCountryFromHeaders(req);
  const currencyCode = resolveCurrencyForRequest(req, country) as CurrencyCode;
  const page = await getSearchResultsPage(
    q,
    Number.isFinite(offset) ? offset : 0,
    Number.isFinite(limit) ? Math.min(Math.max(1, limit), SEARCH_ENGINE_DEFAULTS.PAGE_SIZE) : SEARCH_ENGINE_DEFAULTS.PAGE_SIZE,
    sort,
    currencyCode,
  );
  return NextResponse.json(page);
}