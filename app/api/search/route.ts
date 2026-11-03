import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/lib/supabase/server";

const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
const GOOGLE_TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2";

function isArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

async function translateToEnglish(text: string): Promise<string> {
  if (!GOOGLE_TRANSLATE_API_KEY) {
    console.warn("[search] GOOGLE_TRANSLATE_API_KEY not configured, using original text");
    return text;
  }

  try {
    const params = new URLSearchParams({
      q: text,
      target: "en",
      source: "ar",
      key: GOOGLE_TRANSLATE_API_KEY,
    });

    const response = await fetch(`${GOOGLE_TRANSLATE_URL}?${params.toString()}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error(`[search] Google Translate error: ${response.status}`);
      return text;
    }

    const data = await response.json();
    return data.data?.translations?.[0]?.translatedText ?? text;
  } catch (error) {
    console.error("[search] Translation failed:", error);
    return text;
  }
}

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "40"), 100);

  if (!q.trim()) {
    return NextResponse.json({ products: [], total: 0 });
  }

  const trimmed = q.trim();
  const isArabicQuery = isArabic(trimmed);

  let searchQuery = trimmed;
  if (isArabicQuery) {
    searchQuery = await translateToEnglish(trimmed);
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