import { NextResponse } from "next/server";
import { getSearchResultsPage } from "@/lib/data/homepage";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";

export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const limit = Number(
    url.searchParams.get("limit") ?? SEARCH_ENGINE_DEFAULTS.PAGE_SIZE
  );
  const sortRaw = url.searchParams.get("sort") ?? "relevance";
  const sort = sortRaw === "price" || sortRaw === "price_low" ? "price" : "relevance";
  const page = await getSearchResultsPage(
    q,
    Number.isFinite(offset) ? offset : 0,
    Number.isFinite(limit) ? Math.min(Math.max(1, limit), SEARCH_ENGINE_DEFAULTS.PAGE_SIZE) : SEARCH_ENGINE_DEFAULTS.PAGE_SIZE,
    sort,
  );
  return NextResponse.json(page);
}