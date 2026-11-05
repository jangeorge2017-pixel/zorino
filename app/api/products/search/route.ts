import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import { translateSearchQuery } from "@/lib/search/query-translation";

interface ProductRow { id: string; name: string; price: number; original_price: number; image_url: string; store: string; store_slug: string; rating: number; review_count: number; category: string; currency: string; country_code: string; affiliate_url: string; }

export async function GET(req: NextRequest) {
  const rawQuery = new URL(req.url).searchParams.get("q")?.trim() || "";
  if (!rawQuery) return NextResponse.json([]);

  const q = decodeURIComponent(rawQuery);
  const { translatedQuery } = await translateSearchQuery(q);
  const searchQuery = translatedQuery || q;

  const supabase = createSupabaseAnonClient();
  if (!supabase) return NextResponse.json([]);

  const { data } = await supabase.from("products").select("*").ilike("title", `%${searchQuery}%`).limit(20);

  return NextResponse.json((data || []).map((p: ProductRow) => ({
    id: p.id, name: p.name, price: p.price, originalPrice: p.original_price,
    imageSrc: p.image_url, store: p.store, storeSlug: p.store_slug,
    rating: p.rating ?? 0, reviewCount: p.review_count ?? 0, category: p.category,
    currency: p.currency, countryCode: p.country_code, affiliateUrl: p.affiliate_url,
    emoji: "", discount: p.original_price ? Math.round((1 - p.price / p.original_price) * 100) : 0,
    inStock: true, salesCount: 0, shipping: "", condition: "new"
  })));
}