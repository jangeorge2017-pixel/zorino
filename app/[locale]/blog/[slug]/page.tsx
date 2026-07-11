import { notFound } from "next/navigation";
import BlogPostPageClient from "@/components/BlogPostPageClient";
import {
  getPublishedBlogPost,
  getRelatedBlogPosts,
} from "@/lib/data/blog";
import { generateBlogPostMetadata } from "@/lib/seo/metadata";

type BlogPostPageProps = {
  params: Promise<{ slug: string; locale: string }>;
};

export async function generateMetadata({ params }: BlogPostPageProps) {
  const { slug, locale } = await params;
  const post = await getPublishedBlogPost(slug);
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
  const post = await getPublishedBlogPost(slug);
  if (!post) notFound();

  const related = await getRelatedBlogPosts(slug, post.categorySlug);
  return <BlogPostPageClient post={post} related={related} />;
}
