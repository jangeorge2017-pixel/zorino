import { notFound } from "next/navigation";
import BlogPostPageClient from "@/components/BlogPostPageClient";
import { getMockBlogPost, getMockRelatedBlogPosts } from "@/lib/mock/page-data";
import { generateBlogPostMetadata } from "@/lib/seo/metadata";

type BlogPostPageProps = {
  params: Promise<{ slug: string; locale: string }>;
};

export async function generateMetadata({ params }: BlogPostPageProps) {
  const { slug, locale } = await params;
  const post = getMockBlogPost(slug);
  if (!post) {
    return { title: "Blog" };
  }
  return generateBlogPostMetadata(
    {
      title: post.title,
      excerpt: post.excerpt,
      image: post.image || "/og-image.png",
      author: typeof post.author === "string" ? post.author : "ZORINO",
      publishedAt: post.publishedAt,
      slug: post.slug,
    },
    { locale: locale === "ar" ? "ar" : "en" },
  );
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getMockBlogPost(slug);
  if (!post) notFound();

  const related = getMockRelatedBlogPosts(slug);
  return <BlogPostPageClient post={post} related={related} />;
}
