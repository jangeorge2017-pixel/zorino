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

const QUICK_FILTERS: { id: QuickFilter; label: string }[] = [
  { id: "all", label: "All Articles" },
  { id: "deals", label: "Deals & Discounts" },
  { id: "guides", label: "Shopping Guides" },
  { id: "reviews", label: "Product Reviews" },
  { id: "tips", label: "Money Saving Tips" },
];

export default function BlogPageClient({ posts }: BlogPageClientProps) {
  const t = useTranslations("blog");
  const tCommon = useTranslations("common");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

  const categories = [
    { value: "", label: "All Categories" },
    { value: "deals", label: "Deals & Discounts" },
    { value: "guides", label: "Shopping Guides" },
    { value: "reviews", label: "Product Reviews" },
    { value: "tips", label: "Money Saving Tips" },
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
            aria-label="Quick article filters"
          >
            {QUICK_FILTERS.map((item) => (
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
                options={[
                  { value: "newest", label: "Newest First" },
                  { value: "popular", label: "Most Popular" },
                  { value: "oldest", label: "Oldest First" },
                ]}
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
                <strong>{stats.articleCount}</strong> editorial articles
              </>
            ) : (
              <>
                Showing <strong>{filtered.length}</strong>{" "}
                {filtered.length === 1 ? "article" : "articles"}
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
          <PageEmptyState
            title="No articles found"
            description="Try adjusting your filters or check back later for new stories."
          />
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
          title="Turn reading into real savings"
          description="Apply what you learn — compare prices, grab coupon codes, and shop verified partner stores."
        >
          <Link href="/deals"><Button>Shop Deals</Button></Link>
          <Link href="/blog"><Button variant="outline">More Articles</Button></Link>
        </PageIdentityCta>
      </div>
    </PageLayout>
  );
}
