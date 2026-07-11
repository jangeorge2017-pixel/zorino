import type { MetadataRoute } from "next";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import { IMPORTED_PRODUCT_SYNC_STATUS } from "@/lib/catalog/imported-products";
import { locales } from "@/i18n/config";
import { buildLocalizedUrl } from "@/lib/international/urls";
import { getSiteUrl } from "@/lib/site-url";

const BASE_URL = getSiteUrl();
const PRODUCT_PAGE_SIZE = 1000;
const MAX_PRODUCT_PAGES = 5;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  // Public marketing / catalog routes only (no private account UX).
  const staticPaths = [
    "",
    "/deals",
    "/coupons",
    "/categories",
    "/stores",
    "/products",
    "/about",
    "/contact",
    "/faq",
    "/privacy",
    "/terms",
    "/cookies",
    "/affiliate-disclosure",
    "/dmca",
    "/accessibility",
    "/blog",
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const path of staticPaths) {
      entries.push({
        url: buildLocalizedUrl(path || "/", locale, BASE_URL),
        lastModified: now,
        changeFrequency: path === "" ? "daily" : path === "/deals" ? "hourly" : "weekly",
        priority: path === "" ? 1 : 0.7,
      });
    }
  }

  const supabase = createSupabaseAnonClient();
  if (supabase) {
    for (let page = 0; page < MAX_PRODUCT_PAGES; page++) {
      const from = page * PRODUCT_PAGE_SIZE;
      const to = from + PRODUCT_PAGE_SIZE - 1;
      const { data: products } = await supabase
        .from("products")
        .select("id, slug, updated_at")
        .eq("is_active", true)
        .eq("sync_status", IMPORTED_PRODUCT_SYNC_STATUS)
        .range(from, to);

      const rows = (products ?? []) as {
        id: string;
        slug: string;
        updated_at: string | null;
      }[];
      if (rows.length === 0) break;

      for (const product of rows) {
        for (const locale of locales) {
          entries.push({
            url: buildLocalizedUrl(`/product/${product.id}`, locale, BASE_URL),
            lastModified: product.updated_at ? new Date(product.updated_at) : now,
            changeFrequency: "daily",
            priority: 0.8,
          });
        }
      }

      if (rows.length < PRODUCT_PAGE_SIZE) break;
    }

    const { data: categories } = await supabase
      .from("categories")
      .select("slug, updated_at")
      .eq("is_active", true)
      .limit(200);

    for (const category of (categories ?? []) as { slug: string; updated_at: string | null }[]) {
      for (const locale of locales) {
        entries.push({
          url: buildLocalizedUrl(`/categories/${category.slug}`, locale, BASE_URL),
          lastModified: category.updated_at ? new Date(category.updated_at) : now,
          changeFrequency: "weekly",
          priority: 0.6,
        });
      }
    }

    const { data: posts } = await supabase
      .from("blog_posts")
      .select("slug, updated_at, published_at")
      .eq("published", true)
      .limit(200);

    for (const post of (posts ?? []) as {
      slug: string;
      updated_at: string | null;
      published_at: string | null;
    }[]) {
      for (const locale of locales) {
        entries.push({
          url: buildLocalizedUrl(`/blog/${post.slug}`, locale, BASE_URL),
          lastModified: new Date(post.updated_at ?? post.published_at ?? now),
          changeFrequency: "weekly",
          priority: 0.5,
        });
      }
    }
  }

  return entries;
}
