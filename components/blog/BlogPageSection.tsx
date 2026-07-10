"use client";

import { useTranslations } from "next-intl";
import { BookOpen, Compass, Newspaper, TrendingUp } from "lucide-react";
import BlogArticleCard from "@/components/blog/BlogArticleCard";
import type { BlogSectionId } from "@/components/blog/blog-sections";
import type { MockBlogPost } from "@/lib/mock/types";

const SECTION_ICONS: Record<BlogSectionId, typeof BookOpen> = {
  editors: BookOpen,
  latest: Newspaper,
  popular: TrendingUp,
  guides: Compass,
};

const SECTION_KEYS: Record<BlogSectionId, { title: string; subtitle: string }> = {
  editors: { title: "sectionFeaturedTitle", subtitle: "sectionFeaturedSubtitle" },
  latest: { title: "sectionLatestTitle", subtitle: "sectionLatestSubtitle" },
  popular: { title: "sectionPopularTitle", subtitle: "sectionPopularSubtitle" },
  guides: { title: "sectionGuidesTitle", subtitle: "sectionGuidesSubtitle" },
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
  const t = useTranslations("blog");
  const keys = SECTION_KEYS[sectionId];
  const Icon = SECTION_ICONS[sectionId];
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
              {t(keys.title)}
            </h2>
            <p className="zor-blog-page__section-subtitle">{t(keys.subtitle)}</p>
          </div>
        </div>
        <span className="zor-blog-page__section-count">
          {t("sectionCount", { count: posts.length })}
        </span>
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
