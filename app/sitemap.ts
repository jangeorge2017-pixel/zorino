import type { MetadataRoute } from "next";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import { IMPORTED_PRODUCT_SYNC_STATUS } from "@/lib/catalog/imported-products";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://zorino.com";
const LOCALES = ["en", "ar"] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPaths = [
    "",
    "/deals",
    "/coupons",
    "/categories",
    "/stores",
    "/search",
    "/blog",
    "/about",
    "/contact",
    "/faq",
    "/privacy",
    "/terms",
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of LOCALES) {
    for (const path of staticPaths) {
      entries.push({
        url: `${BASE_URL}/${locale}${path}`,
        lastModified: now,
        changeFrequency: path === "" ? "daily" : path === "/deals" ? "hourly" : "weekly",
        priority: path === "" ? 1 : 0.7,
      });
    }
  }

  const supabase = createSupabaseAnonClient();
  if (supabase) {
    const { data: products } = await supabase
      .from("products")
      .select("id, slug, updated_at")
      .eq("is_active", true)
      .eq("sync_status", IMPORTED_PRODUCT_SYNC_STATUS)
      .limit(500);

    for (const product of (products ?? []) as { id: string; slug: string; updated_at: string | null }[]) {
      for (const locale of LOCALES) {
        entries.push({
          url: `${BASE_URL}/${locale}/product/${product.id}`,
          lastModified: product.updated_at ? new Date(product.updated_at) : now,
          changeFrequency: "daily",
          priority: 0.8,
        });
      }
    }

    const { data: categories } = await supabase
      .from("categories")
      .select("slug, updated_at")
      .eq("is_active", true)
      .limit(100);

    for (const category of (categories ?? []) as { slug: string; updated_at: string | null }[]) {
      for (const locale of LOCALES) {
        entries.push({
          url: `${BASE_URL}/${locale}/category/${category.slug}`,
          lastModified: category.updated_at ? new Date(category.updated_at) : now,
          changeFrequency: "weekly",
          priority: 0.6,
        });
      }
    }
  }

  return entries;
}
