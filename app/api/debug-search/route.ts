import { NextResponse } from "next/server";
import { translateSearchQuery } from "@/lib/search/query-translation";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  try {
    const result = await translateSearchQuery(query);
    return NextResponse.json({
      status: "success",
      input_received: query,
      translated_output: result.translatedQuery,
      was_translated: result.wasTranslated,
      is_arabic: result.isArabic,
      is_franco_arab: result.isFrancoArab,
      original_query: result.originalQuery,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: "error", message });
  }
}