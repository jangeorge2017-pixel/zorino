"use client";

import { BookOpen, Compass, Newspaper, TrendingUp } from "lucide-react";
import BlogArticleCard from "@/components/blog/BlogArticleCard";
import type { BlogSectionId } from "@/components/blog/blog-sections";
import type { MockBlogPost } from "@/lib/mock/types";

const SECTION_META: Record<
  BlogSectionId,
  { title: string; subtitle: string; icon: typeof BookOpen }
> = {
  editors: {
    title: "Editor's Picks",
    subtitle: "Hand-selected stories from the Zorino editorial team",
    icon: BookOpen,
  },
  latest: {
    title: "Latest Articles",
    subtitle: "Fresh insights, guides, and deal coverage",
    icon: Newspaper,
  },
  popular: {
    title: "Most Popular",
    subtitle: "The articles readers are engaging with most",
    icon: TrendingUp,
  },
  guides: {
    title: "Shopping Guides",
    subtitle: "Expert advice to shop smarter and save more",
    icon: Compass,
  },
};

type BlogPageSectionProps = {
  sectionId: BlogSectionId;
  posts: MockBlogPost[];
  readLabel: string;
  featuredLabel?: string;
};

export default function BlogPageSection({
  sectionId,
  posts,
  readLabel,
  featuredLabel,
}: BlogPageSectionProps) {
  const meta = SECTION_META[sectionId];
  const Icon = meta.icon;
  const useFeaturedLayout = sectionId === "editors" && posts.length === 1;

  return (
    <section
      className={`zor-blog-page__section zor-blog-page__section--${sectionId}`}
      aria-labelledby={`blog-section-${sectionId}`}
    >
      <header className="zor-blog-page__section-head">
        <div className="zor-blog-page__section-title-wrap">
          <span className="zor-blog-page__section-icon" aria-hidden>
            <Icon size={18} />
          </span>
          <div>
            <h2 id={`blog-section-${sectionId}`} className="zor-blog-page__section-title">
              {meta.title}
            </h2>
            <p className="zor-blog-page__section-subtitle">{meta.subtitle}</p>
          </div>
        </div>
        <span className="zor-blog-page__section-count">{posts.length} articles</span>
      </header>

      {useFeaturedLayout ? (
        <BlogArticleCard
          post={posts[0]}
          readLabel={readLabel}
          featuredLabel={featuredLabel}
          variant="featured"
        />
      ) : (
        <div className="zor-blog-page__grid zor-blog-page__section-grid">
          {posts.map((post) => (
            <BlogArticleCard
              key={post.id}
              post={post}
              readLabel={readLabel}
              featuredLabel={featuredLabel}
              variant="grid"
            />
          ))}
        </div>
      )}
    </section>
  );
}
