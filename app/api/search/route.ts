import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import { translateSearchQuery } from "@/lib/search/query-translation";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "40"), 100);

  if (!q.trim()) {
    return NextResponse.json({ products: [], total: 0 });
  }

  const trimmed = q.trim();
  const { translatedQuery, isArabic, isFrancoArab } = await translateSearchQuery(trimmed);

  const searchQuery = translatedQuery || trimmed;
  const wasTranslated = isArabic || isFrancoArab;

  if (wasTranslated) {
    console.log(`[search] ${isArabic ? "Arabic" : "Franco-Arab"} query "${trimmed}" translated to "${searchQuery}"`);
  }

  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // Primary search with translated query
  let { data, error, count } = await supabase
    .from("products")
    .select("*", { count: "exact" })
    .ilike("title", `%${searchQuery}%`)
    .limit(limit);

  // Fallback: if translated search returns no results and query was translated,
  // search with original query using ilike
  const hasData = Array.isArray(data) && data.length > 0;
  if (!hasData && wasTranslated && searchQuery !== trimmed) {
    const fallback = await supabase
      .from("products")
      .select("*", { count: "exact" })
      .ilike("title", `%${trimmed}%`)
      .limit(limit);
    if (!fallback.error && fallback.data && fallback.data.length > 0) {
      data = fallback.data;
      count = fallback.count;
      error = null;
    }
  }

  if (error) {
    console.error("[search] Supabase error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }

  return NextResponse.json({
    products: data ?? [],
    total: count ?? 0,
    translated: wasTranslated ? searchQuery : null,
  });
}