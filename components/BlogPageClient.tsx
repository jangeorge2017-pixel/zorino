"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import { PageFilterBar, PageHeader, PageLayout } from "@/components/pages";
import { ArrowRight, Calendar, Clock, User } from "lucide-react";
import type { MockBlogPost } from "@/lib/mock/types";

type BlogPageClientProps = {
  posts: MockBlogPost[];
};

export default function BlogPageClient({ posts }: BlogPageClientProps) {
  const t = useTranslations("blog");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  const categories = [
    { value: "", label: "All Categories" },
    { value: "deals", label: "Deals & Discounts" },
    { value: "guides", label: "Shopping Guides" },
    { value: "reviews", label: "Product Reviews" },
    { value: "tips", label: "Money Saving Tips" },
  ];

  const filtered = useMemo(() => {
    return [...posts]
      .filter((p) => !selectedCategory || p.categorySlug === selectedCategory)
      .sort((a, b) => {
        if (sortBy === "popular") return b.views - a.views;
        if (sortBy === "oldest") return a.publishedAt.localeCompare(b.publishedAt);
        return b.publishedAt.localeCompare(a.publishedAt);
      });
  }, [posts, selectedCategory, sortBy]);

  const featuredPost = filtered.find((p) => p.featured);
  const regularPosts = filtered.filter((p) => !p.featured);

  return (
    <PageLayout>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <PageFilterBar>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label={t("categories")}
            options={categories}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          />
          <Select
            label="Sort By"
            options={[
              { value: "newest", label: "Newest First" },
              { value: "popular", label: "Most Popular" },
              { value: "oldest", label: "Oldest First" },
            ]}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          />
          <div className="flex items-end">
            <Button className="w-full">Apply Filters</Button>
          </div>
        </div>
      </PageFilterBar>

      {featuredPost ? (
        <Card hover className="mb-12 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="text-9xl flex items-center justify-center bg-gray-800/50 rounded-2xl p-8">
              {featuredPost.image}
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-4 mb-4">
                <span className="bg-gradient-to-r from-purple-600 to-blue-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                  Featured
                </span>
                <span className="text-gray-400 text-sm">{featuredPost.category}</span>
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">{featuredPost.title}</h2>
              <p className="text-gray-300 mb-6">{featuredPost.excerpt}</p>
              <div className="flex flex-wrap items-center gap-6 text-sm text-gray-400 mb-6">
                <span className="flex items-center gap-2"><User className="w-4 h-4" />{featuredPost.author}</span>
                <span className="flex items-center gap-2"><Calendar className="w-4 h-4" />{featuredPost.publishedAt}</span>
                <span className="flex items-center gap-2"><Clock className="w-4 h-4" />{featuredPost.readingTime}</span>
              </div>
              <Link href={`/blog/${featuredPost.slug}`}>
                <Button>
                  {t("readArticle")}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {regularPosts.map((post) => (
          <Card key={post.id} hover>
            <div className="text-6xl text-center py-6 mb-4">{post.image}</div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-purple-400 text-sm font-medium">{post.category}</span>
              <span className="text-gray-600">•</span>
              <span className="text-gray-400 text-sm">{post.publishedAt}</span>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2 line-clamp-2">{post.title}</h3>
            <p className="text-gray-400 text-sm mb-4 line-clamp-2">{post.excerpt}</p>
            <Link href={`/blog/${post.slug}`}>
              <Button variant="outline" size="sm" className="w-full">
                {t("readArticle")}
              </Button>
            </Link>
          </Card>
        ))}
      </div>
    </PageLayout>
  );
}
