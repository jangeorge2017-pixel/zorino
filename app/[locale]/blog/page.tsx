import BlogPageClient from "@/components/BlogPageClient";
import { getMockBlogPosts } from "@/lib/mock/page-data";
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

export default function BlogPage() {
  const posts = getMockBlogPosts();
  return <BlogPageClient posts={posts} />;
}
