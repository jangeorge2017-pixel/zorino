"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import ListingProductCard from "@/components/ListingProductCard";
import {
  PageEmptyState,
  PageFilterBar,
  PageHeader,
  PageLayout,
} from "@/components/pages";
import type { SearchResultItem } from "@/lib/data/homepage";

type ProductsPageClientProps = {
  products: SearchResultItem[];
  categories: { value: string; label: string }[];
  stores: { value: string; label: string }[];
};

export default function ProductsPageClient({
  products,
  categories,
  stores,
}: ProductsPageClientProps) {
  const t = useTranslations("products");
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") ?? "";
  const initialStore = searchParams.get("store") ?? "";
  const initialSort = searchParams.get("sort") ?? "popular";

  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedStore, setSelectedStore] = useState(initialStore);
  const [sortBy, setSortBy] = useState(initialSort);
  const [inStockOnly, setInStockOnly] = useState(false);

  const categoryOptions = [{ value: "", label: "All Categories" }, ...categories];
  const storeOptions = [{ value: "", label: "All Stores" }, ...stores];

  const sortOptions = [
    { value: "popular", label: "Most Popular" },
    { value: "new", label: "New Arrivals" },
    { value: "price_low", label: "Price: Low to High" },
    { value: "price_high", label: "Price: High to Low" },
    { value: "rating", label: "Top Rated" },
    { value: "price_drop", label: "Biggest Price Drops" },
  ];

  const filtered = useMemo(() => {
    return [...products]
      .filter((product) => {
        if (selectedCategory && product.category !== selectedCategory) return false;
        if (selectedStore && product.storeSlug !== selectedStore) return false;
        if (inStockOnly && !product.inStock) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "price_low") return a.price - b.price;
        if (sortBy === "price_high") return b.price - a.price;
        if (sortBy === "rating") return b.rating - a.rating;
        if (sortBy === "price_drop") {
          const dropA = (a.originalPrice ?? a.price) - a.price;
          const dropB = (b.originalPrice ?? b.price) - b.price;
          return dropB - dropA;
        }
        return b.reviewCount - a.reviewCount;
      });
  }, [products, selectedCategory, selectedStore, sortBy, inStockOnly]);

  return (
    <PageLayout>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
      />

      <PageFilterBar>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Select
            label="Category"
            options={categoryOptions}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          />
          <Select
            label="Store"
            options={storeOptions}
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
          />
          <Select
            label="Sort by"
            options={sortOptions}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          />
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600"
              />
              In stock only
            </label>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setSelectedCategory("");
                setSelectedStore("");
                setSortBy("popular");
                setInStockOnly(false);
              }}
            >
              Reset
            </Button>
          </div>
        </div>
      </PageFilterBar>

      {filtered.length === 0 ? (
        <PageEmptyState
          title="No products found"
          description="Try adjusting your filters or browse all categories."
        />
      ) : (
        <div className="listing-products-grid">
          {filtered.map((product) => (
            <ListingProductCard
              key={product.id}
              product={{
                id: product.id,
                name: product.name,
                imageSrc: product.imageSrc,
                emoji: product.emoji,
                price: product.price,
                originalPrice: product.originalPrice,
                rating: product.rating,
                reviewCount: product.reviewCount,
                store: product.store,
                category: product.category,
                inStock: product.inStock,
              }}
            />
          ))}
        </div>
      )}
    </PageLayout>
  );
}
