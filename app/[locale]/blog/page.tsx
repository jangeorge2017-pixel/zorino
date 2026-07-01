import BlogPageClient from "@/components/BlogPageClient";
import { getMockBlogPosts } from "@/lib/mock/page-data";

export default function BlogPage() {
  const posts = getMockBlogPosts();
  return <BlogPageClient posts={posts} />;
}
