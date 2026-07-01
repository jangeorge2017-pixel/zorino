"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import ListingProductCard from "@/components/ListingProductCard";
import { PageFilterBar, PageHeader, PageLayout } from "@/components/pages";
import type { MockCategoryDetail } from "@/lib/mock/types";

type CategoryDetailPageClientProps = {
  detail: MockCategoryDetail;
};

export default function CategoryDetailPageClient({ detail }: CategoryDetailPageClientProps) {
  const t = useTranslations("categories");
  const { category, description, products } = detail;
  const [sortBy, setSortBy] = useState("discount");

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      if (sortBy === "price_low") return a.price - b.price;
      if (sortBy === "price_high") return b.price - a.price;
      if (sortBy === "rating") return b.rating - a.rating;
      return b.discount - a.discount;
    });
  }, [products, sortBy]);

  return (
    <PageLayout>
      <PageHeader
        title={`${category.icon ?? "📦"} ${category.name}`}
        subtitle={description}
        actions={
          <Link href="/categories">
            <Button variant="outline">All Categories</Button>
          </Link>
        }
      />

      <Card className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-gray-400 text-sm">{t("categories")}</p>
          <p className="text-white font-semibold text-xl">
            {category.productCount.toLocaleString()} products tracked
          </p>
        </div>
        <Link href="/search">
          <Button>Search in {category.name}</Button>
        </Link>
      </Card>

      <PageFilterBar>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label="Sort By"
            options={[
              { value: "discount", label: "Highest Discount" },
              { value: "price_low", label: "Price: Low to High" },
              { value: "price_high", label: "Price: High to Low" },
              { value: "rating", label: "Rating" },
            ]}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          />
          <div className="md:col-span-2 flex items-end">
            <Link href="/deals" className="w-full">
              <Button variant="outline" className="w-full">View Trending Deals</Button>
            </Link>
          </div>
        </div>
      </PageFilterBar>

      <div className="listing-products-grid">
        {sortedProducts.map((product) => (
          <ListingProductCard key={product.id} product={product} />
        ))}
      </div>
    </PageLayout>
  );
}
