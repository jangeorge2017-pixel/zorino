"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import ListingProductCard from "@/components/ListingProductCard";
import CategoryDetailHero from "@/components/categories/CategoryDetailHero";
import PageIdentityCta from "@/components/page-identity/PageIdentityCta";
import { PageFilterBar, PageLayout } from "@/components/pages";
import type { MockCategoryDetail } from "@/lib/mock/types";
import "@/components/categories/categories-page.css";

type CategoryDetailPageClientProps = {
  detail: MockCategoryDetail;
};

export default function CategoryDetailPageClient({ detail }: CategoryDetailPageClientProps) {
  const t = useTranslations("categories");
  const { category, products } = detail;
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
      <div className="zor-categories-page">
        <CategoryDetailHero detail={detail} categoriesLabel={t("title")} />

        <PageFilterBar className="zor-categories-page__filters">
          <div className="zor-categories-page__filter-grid">
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
            <div className="zor-categories-page__filter-action">
              <Link href="/deals" className="w-full block">
                <Button variant="outline" className="w-full">View Trending Deals</Button>
              </Link>
            </div>
            <div className="zor-categories-page__filter-action">
              <Link href="/compare" className="w-full block">
                <Button className="w-full">Compare Prices</Button>
              </Link>
            </div>
          </div>
        </PageFilterBar>

        <div className="listing-products-grid zor-categories-page__detail-grid">
          {sortedProducts.map((product) => (
            <ListingProductCard key={product.id} product={product} />
          ))}
        </div>

        <PageIdentityCta
          block="zor-categories-page"
          title={`Keep exploring ${category.name}`}
          description="Compare top products in this category and unlock coupon codes from partner stores."
        >
          <Link href="/search"><Button>Search Products</Button></Link>
          <Link href="/categories"><Button variant="outline">All Categories</Button></Link>
        </PageIdentityCta>
      </div>
    </PageLayout>
  );
}
