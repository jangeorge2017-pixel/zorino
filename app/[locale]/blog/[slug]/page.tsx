import { notFound } from "next/navigation";
import BlogPostPageClient from "@/components/BlogPostPageClient";
import { getMockBlogPost, getMockRelatedBlogPosts } from "@/lib/mock/page-data";

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getMockBlogPost(slug);
  if (!post) notFound();

  const related = getMockRelatedBlogPosts(slug);
  return <BlogPostPageClient post={post} related={related} />;
}
