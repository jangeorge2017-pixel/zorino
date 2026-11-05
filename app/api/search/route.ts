import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import { detectAndTranslateArabic } from "@/lib/search/translation";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "40"), 100);

  if (!q.trim()) {
    return NextResponse.json({ products: [], total: 0 });
  }

  const trimmed = q.trim();
  const { translatedQuery, isArabic: isArabicQuery } = await detectAndTranslateArabic(trimmed);

  const searchQuery = translatedQuery || trimmed;

  if (isArabicQuery) {
    console.log(`[search] Arabic query "${trimmed}" translated to "${searchQuery}"`);
  }

  const supabase = createSupabaseAnonClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { data, error, count } = await supabase
    .from("products")
    .select("*", { count: "exact" })
    .ilike("title", `%${searchQuery}%`)
    .limit(limit);

  if (error) {
    console.error("[search] Supabase error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }

  return NextResponse.json({
    products: data ?? [],
    total: count ?? 0,
    translated: isArabicQuery ? searchQuery : null,
  });
}