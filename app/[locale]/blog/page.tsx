import BlogPageClient from "@/components/BlogPageClient";
import { getPublishedBlogPosts } from "@/lib/data/blog";
import { generateMetadata as buildSeoMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return buildSeoMetadata({
    title: "Blog",
    description: "Latest news, tips, and guides",
    pathname: "/blog",
    locale: locale === "ar" ? "ar" : "en",
  });
}

export default async function BlogPage() {
  const posts = await getPublishedBlogPosts();
  return <BlogPageClient posts={posts} />;
}
