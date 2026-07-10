"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Search, Filter } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import ListingProductCard from "@/components/ListingProductCard";
import { PageHeader, PageLayout } from "@/components/pages";
import type { SearchResultItem } from "@/lib/data/homepage";

type SearchPageClientProps = {
  initialQuery: string;
  initialResults: SearchResultItem[];
  categories: { value: string; label: string }[];
  stores: { value: string; label: string }[];
};

export default function SearchPageClient({
  initialQuery,
  initialResults,
  categories,
  stores,
}: SearchPageClientProps) {
  const t = useTranslations("search");
  const tCommon = useTranslations("common");
  const tStores = useTranslations("stores");
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [rating, setRating] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState("relevance");

  const categoryOptions = [
    { value: "", label: t("allCategories") },
    ...categories,
  ];
  const storeOptions = [
    { value: "", label: tStores("allStores") },
    ...stores,
  ];

  const sortOptions = [
    { value: "relevance", label: tCommon("relevance") },
    { value: "price_low", label: tCommon("priceLow") },
    { value: "price_high", label: tCommon("priceHigh") },
    { value: "rating", label: t("sortRating") },
  ];

  const ratingOptions = [
    { value: "", label: t("allRatings") },
    { value: "4", label: t("rating4Plus") },
    { value: "3", label: t("rating3Plus") },
    { value: "2", label: t("rating2Plus") },
  ];

  const filteredResults = useMemo(() => {
    return [...initialResults]
      .filter((product) => {
        if (selectedCategory && product.category !== selectedCategory) return false;
        if (selectedStore && product.storeSlug !== selectedStore) return false;
        if (minPrice && product.price < Number(minPrice)) return false;
        if (maxPrice && product.price > Number(maxPrice)) return false;
        if (rating && product.rating < Number(rating)) return false;
        if (inStockOnly && !product.inStock) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "price_low") return a.price - b.price;
        if (sortBy === "price_high") return b.price - a.price;
        if (sortBy === "rating") return b.rating - a.rating;
        return 0;
      });
  }, [
    initialResults,
    selectedCategory,
    selectedStore,
    minPrice,
    maxPrice,
    rating,
    inStockOnly,
    sortBy,
  ]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    router.push(`/search?${params.toString()}`);
  };

  return (
    <PageLayout>
      <PageHeader
        title={t("title")}
        subtitle={
          initialQuery
            ? filteredResults.length > 0
              ? `${t("subtitle")} "${initialQuery}"`
              : t("noResults")
            : t("noResults")
        }
      />

      <div className="zor-page-grid">
        <aside className="zor-filter-sidebar">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Filter className="w-5 h-5" />
              {t("filters")}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => {
                setSelectedCategory("");
                setSelectedStore("");
                setMinPrice("");
                setMaxPrice("");
                setRating("");
                setInStockOnly(false);
              }}
            >
              {tCommon("clear")}
            </Button>
          </div>

          <form onSubmit={handleSearch} className="space-y-6">
            <Input
              label={tCommon("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
            />

            <Select
              label={tCommon("categories")}
              options={categoryOptions}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            />

            <Select
              label={tCommon("stores")}
              options={storeOptions}
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
            />

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t("priceRange")}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder={t("minPrice")}
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
                <Input
                  placeholder={t("maxPrice")}
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>
            </div>

            <Select
              label={t("rating")}
              options={ratingOptions}
              value={rating}
              onChange={(e) => setRating(e.target.value)}
            />

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-300">{t("inStockOnly")}</span>
            </label>

            <Button type="submit" className="w-full">
              {tCommon("filter")}
            </Button>
          </form>
        </aside>

        <div>
          <div className="flex items-center justify-between mb-6">
            <span className="text-gray-400">
              {t("resultsFound", { count: filteredResults.length })}
            </span>
            <Select
              options={sortOptions}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-48"
            />
          </div>

          {filteredResults.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">{t("noResults")}</h3>
              <p className="text-gray-400 mb-4">{t("tryDifferentKeywords")}</p>
            </div>
          ) : (
            <div className="listing-products-grid">
              {filteredResults.map((product) => (
                <ListingProductCard
                  key={product.id}
                  product={{
                    id: product.id,
                    name: product.name,
                    imageSrc: product.imageSrc,
                    emoji: product.emoji,
                    price: product.price,
                    originalPrice: product.originalPrice,
                    discount: product.discount,
                    rating: product.rating,
                    reviewCount: product.reviewCount,
                    salesCount: product.salesCount,
                    store: product.store,
                    storeSlug: product.storeSlug,
                    category: product.category,
                    inStock: product.inStock,
                    affiliateUrl: product.affiliateUrl,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
