import type { MockBlogPost } from "@/lib/mock/types";

export type BlogSectionId = "editors" | "latest" | "popular" | "guides";

export type BlogSection = {
  id: BlogSectionId;
  posts: MockBlogPost[];
};

const SECTION_LIMIT = 4;

function topPosts(pool: MockBlogPost[], limit = SECTION_LIMIT): MockBlogPost[] {
  return pool.slice(0, limit);
}

export function buildBlogSections(posts: MockBlogPost[]): BlogSection[] {
  const editors = topPosts(
    [...posts].filter((post) => post.featured).sort((a, b) => b.views - a.views),
  );

  const latest = topPosts(
    [...posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
  );

  const popular = topPosts(
    [...posts].sort((a, b) => b.views - a.views),
  );

  const guides = topPosts(
    [...posts]
      .filter((post) => post.categorySlug === "guides")
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
  );

  const sections: BlogSection[] = [
    { id: "editors", posts: editors },
    { id: "latest", posts: latest },
    { id: "popular", posts: popular },
    { id: "guides", posts: guides },
  ];

  return sections.filter((section) => section.posts.length > 0);
}
