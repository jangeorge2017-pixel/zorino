import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { MockBlogPost } from "@/lib/mock/types";

type BlogRow = {
  id: string;
  title: string;
  title_ar?: string | null;
  slug: string;
  excerpt: string;
  excerpt_ar?: string | null;
  content: string;
  content_ar?: string | null;
  image_url?: string | null;
  author: string;
  category: string;
  tags: string[] | null;
  published: boolean;
  published_at?: string | null;
  updated_at?: string | null;
  views?: number | null;
  featured?: boolean | null;
};

function estimateReadingTime(content: string): string {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min`;
}

function rowToPost(row: BlogRow): MockBlogPost {
  const content = (row.content || "")
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    titleAr: row.title_ar || row.title,
    excerpt: row.excerpt || "",
    excerptAr: row.excerpt_ar || row.excerpt || "",
    image: row.image_url || "/og-image.png",
    author: row.author || "ZORINO",
    category: row.category || "Guides",
    categorySlug: (row.category || "guides").toLowerCase().replace(/\s+/g, "-"),
    tags: row.tags ?? [],
    publishedAt: row.published_at || row.updated_at || new Date().toISOString(),
    readingTime: estimateReadingTime(row.content || row.excerpt || ""),
    views: row.views ?? 0,
    featured: Boolean(row.featured),
    content: content.length > 0 ? content : [row.excerpt || row.title],
  };
}

/** Live published blog posts only — never falls back to mock content. */
export async function getPublishedBlogPosts(limit = 100): Promise<MockBlogPost[]> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("published", true)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error("[blog]", error?.message ?? "Failed to load posts");
    return [];
  }

  return (data as BlogRow[]).map(rowToPost);
}

export async function getPublishedBlogPost(slug: string): Promise<MockBlogPost | null> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (error || !data) return null;
  return rowToPost(data as BlogRow);
}

export async function getRelatedBlogPosts(
  slug: string,
  categorySlug: string,
  limit = 3,
): Promise<MockBlogPost[]> {
  const posts = await getPublishedBlogPosts(50);
  return posts
    .filter((p) => p.slug !== slug && p.categorySlug === categorySlug)
    .slice(0, limit);
}
