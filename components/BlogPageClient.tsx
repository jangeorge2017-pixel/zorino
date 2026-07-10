"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import BlogPageHero from "@/components/blog/BlogPageHero";
import BlogPageSection from "@/components/blog/BlogPageSection";
import BlogArticleCard from "@/components/blog/BlogArticleCard";
import { buildBlogSections } from "@/components/blog/blog-sections";
import PageIdentityCta from "@/components/page-identity/PageIdentityCta";
import { PageEmptyState, PageFilterBar, PageLayout } from "@/components/pages";
import { Link } from "@/i18n/navigation";
import type { MockBlogPost } from "@/lib/mock/types";
import "@/components/blog/blog-page.css";

type BlogPageClientProps = {
  posts: MockBlogPost[];
};

type QuickFilter = "all" | "deals" | "guides" | "reviews" | "tips";

export default function BlogPageClient({ posts }: BlogPageClientProps) {
  const t = useTranslations("blog");
  const tCommon = useTranslations("common");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

  const quickFilters: { id: QuickFilter; label: string }[] = [
    { id: "all", label: t("filterAll") },
    { id: "deals", label: t("filterDeals") },
    { id: "guides", label: t("filterGuides") },
    { id: "reviews", label: t("filterReviews") },
    { id: "tips", label: t("filterTips") },
  ];

  const categories = [
    { value: "", label: t("allCategories") },
    { value: "deals", label: t("filterDeals") },
    { value: "guides", label: t("filterGuides") },
    { value: "reviews", label: t("filterReviews") },
    { value: "tips", label: t("filterTips") },
  ];

  const sortOptions = [
    { value: "newest", label: t("sortNewest") },
    { value: "popular", label: t("sortPopular") },
    { value: "oldest", label: t("sortOldest") },
  ];

  const stats = useMemo(() => {
    const featuredCount = posts.filter((post) => post.featured).length;
    const categoryCount = new Set(posts.map((post) => post.categorySlug)).size;
    const totalViews = posts.reduce((sum, post) => sum + post.views, 0);
    return {
      articleCount: posts.length,
      featuredCount,
      categoryCount,
      totalViews,
    };
  }, [posts]);

  const sections = useMemo(() => buildBlogSections(posts), [posts]);

  const filtered = useMemo(() => {
    return [...posts]
      .filter((post) => !selectedCategory || post.categorySlug === selectedCategory)
      .filter((post) => {
        if (quickFilter === "all") return true;
        return post.categorySlug === quickFilter;
      })
      .sort((a, b) => {
        if (sortBy === "popular") return b.views - a.views;
        if (sortBy === "oldest") return a.publishedAt.localeCompare(b.publishedAt);
        return b.publishedAt.localeCompare(a.publishedAt);
      });
  }, [posts, selectedCategory, sortBy, quickFilter]);

  const showCuratedSections =
    quickFilter === "all" && !selectedCategory && sortBy === "newest";

  return (
    <PageLayout>
      <div className="zor-blog-page">
        <BlogPageHero
          title={t("title")}
          subtitle={t("subtitle")}
          articleCount={stats.articleCount}
          featuredCount={stats.featuredCount}
          categoryCount={stats.categoryCount}
          totalViews={stats.totalViews}
        />

        <div className="zor-blog-page__toolbar">
          <div
            className="zor-blog-page__quick-filters"
            role="tablist"
            aria-label={t("quickFiltersAria")}
          >
            {quickFilters.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={quickFilter === item.id}
                className={`zor-blog-page__quick-filter${
                  quickFilter === item.id ? " is-active" : ""
                }`}
                onClick={() => setQuickFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <PageFilterBar className="zor-blog-page__filters">
            <div className="zor-blog-page__filter-grid">
              <Select
                label={t("categories")}
                options={categories}
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              />
              <Select
                label={tCommon("sortBy")}
                options={sortOptions}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              />
              <div className="zor-blog-page__filter-action">
                <Button className="w-full">{tCommon("filter")}</Button>
              </div>
            </div>
          </PageFilterBar>
        </div>

        <div className="zor-blog-page__results-bar">
          <p className="zor-blog-page__results-count">
            {showCuratedSections ? (
              <>
                <strong>{stats.articleCount}</strong> {t("resultsActiveLabel")}
              </>
            ) : (
              <>
                {t("resultsShowingPrefix")} <strong>{filtered.length}</strong>{" "}
                {filtered.length === 1 ? t("resultsArticleOne") : t("resultsArticleMany")}
              </>
            )}
          </p>
        </div>

        {showCuratedSections ? (
          <div className="zor-blog-page__sections">
            {sections.map((section) => (
              <BlogPageSection
                key={section.id}
                sectionId={section.id}
                posts={section.posts}
                readLabel={t("readArticle")}
                featuredLabel={tCommon("featured")}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <PageEmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
        ) : (
          <div className="zor-blog-page__grid">
            {filtered.map((post) => (
              <BlogArticleCard
                key={post.id}
                post={post}
                readLabel={t("readArticle")}
                featuredLabel={tCommon("featured")}
                variant={post.featured ? "featured" : "grid"}
              />
            ))}
          </div>
        )}
        <PageIdentityCta
          block="zor-blog-page"
          title={t("ctaTitle")}
          description={t("ctaDescription")}
        >
          <Link href="/deals">
            <Button>{t("ctaShopDeals")}</Button>
          </Link>
          <Link href="/blog">
            <Button variant="outline">{t("ctaMoreArticles")}</Button>
          </Link>
        </PageIdentityCta>
      </div>
    </PageLayout>
  );
}
