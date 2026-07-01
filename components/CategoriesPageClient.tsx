"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { ArrowRight, Grid3X3, List } from "lucide-react";
import type { Category } from "@/lib/types/entities";

type CategoriesPageClientProps = {
  categories: Category[];
};

export default function CategoriesPageClient({ categories }: CategoriesPageClientProps) {
  const t = useTranslations("categories");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t("title")}</h1>
          <p className="text-gray-400">{t("subtitle")}</p>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "grid" ? "primary" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "primary" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
          <span className="text-gray-400">
            {categories.length} {t("categories")}
          </span>
        </div>

        {categories.length === 0 ? (
          <p className="text-gray-400">No categories available yet.</p>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {categories.map((category) => (
              <Card key={category.id} hover className="text-center">
                <div className="text-5xl mb-4">{category.icon ?? "📦"}</div>
                <h3 className="text-lg font-semibold text-white mb-1">{category.name}</h3>
                <p className="text-sm text-gray-400 mb-3">
                  {category.productCount.toLocaleString()} products
                </p>
                <Link href={`/categories/${category.slug}`} className="w-full">
                  <Button variant="outline" size="sm" className="w-full">
                    {t("viewAll")}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {categories.map((category) => (
              <Card key={category.id} hover className="flex items-center gap-6">
                <div className="text-5xl">{category.icon ?? "📦"}</div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white mb-1">{category.name}</h3>
                  <p className="text-sm text-gray-400 mb-2">
                    {category.productCount.toLocaleString()} products
                  </p>
                </div>
                <Link href={`/categories/${category.slug}`}>
                  <Button variant="outline">
                    {t("viewAll")}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
