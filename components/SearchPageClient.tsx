"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Search, Filter, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import ListingProductCard from "@/components/ListingProductCard";
import { PageHeader, PageLayout } from "@/components/pages";
import type { SearchResultItem } from "@/lib/data/homepage";
import type { SearchPageResult } from "@/lib/search/engine";
import { mergePagedResults } from "@/lib/search/pagination";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";

type SearchPageClientProps = {
  initialQuery: string;
  initialResults: SearchResultItem[];
  total: number;
  hasMore: boolean;
  categories: { value: string; label: string }[];
  stores: { value: string; label: string }[];
};

/**
 * Search results UI with server-side "Load more" pagination.
 *
 * Semantics (chosen to preserve the original all-at-once UX as closely as
 * possible):
 * - The server renders only the FIRST page (PAGE_SIZE items) and streams
 *   additional pages from `/api/search/paged` on demand.
 * - Filter options (categories/stores) are still derived server-side from the
 *   FULL search pool, so every value a result could have is available to
 *   filter by from the start.
 * - Client-side filtering and sorting run over the items LOADED so far. This
 *   is the documented trade-off of incremental loading: the filter/sort
 *   re-applies to everything rendered, but cannot see unloaded pages.
 * - `receivedCount` tracks how many pool items have been consumed, so the
 *   next request always asks for the next contiguous slice regardless of
 *   duplicates dropped by the merge.
 */
export default function SearchPageClient({
  initialQuery,
  initialResults,
  total,
  hasMore,
  categories,
  stores,
}: SearchPageClientProps) {
  const t = useTranslations("search");
  const tCommon = useTranslations("common");
  const tStores = useTranslations("stores");
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [items, setItems] = useState(initialResults);
  const [receivedCount, setReceivedCount] = useState(initialResults.length);
  const [currentHasMore, setCurrentHasMore] = useState(hasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
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
    return [...items]
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
    items,
    selectedCategory,
    selectedStore,
    minPrice,
    maxPrice,
    rating,
    inStockOnly,
    sortBy,
  ]);

  const handleLoadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setLoadError(false);
    try {
      const offset = receivedCount;
      const params = new URLSearchParams({
        q: initialQuery,
        offset: String(offset),
        limit: String(SEARCH_ENGINE_DEFAULTS.PAGE_SIZE),
      });
      const res = await fetch(`/api/search/paged?${params.toString()}`);
      if (!res.ok) throw new Error("paged-search-failed");
      const page = (await res.json()) as SearchPageResult;
      setItems((prev) => mergePagedResults(prev, page.items));
      setReceivedCount((prev) => prev + page.items.length);
      setCurrentHasMore(page.hasMore);
    } catch {
      setLoadError(true);
    } finally {
      setLoadingMore(false);
    }
  };

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
              {total > 0
                ? t("resultsOfTotal", {
                    count: filteredResults.length,
                    total,
                  })
                : t("resultsFound", { count: filteredResults.length })}
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
              {initialQuery.trim() ? (
                <p className="text-sm text-gray-500 max-w-md mx-auto">
                  If results stay empty, marketplace APIs may be temporarily unavailable. Try again
                  shortly or broaden your keywords.
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <div className="listing-products-grid" key={`filters-${selectedStore}-${selectedCategory}-${rating}-${sortBy}-${minPrice}-${maxPrice}-${inStockOnly}`}>
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

              {currentHasMore ? (
                <div className="mt-8 flex flex-col items-center gap-3">
                  {loadError ? (
                    <p className="text-sm text-red-400">{t("loadMoreError")}</p>
                  ) : null}
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="px-8"
                  >
                    {loadingMore ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {tCommon("pleaseWait")}
                      </span>
                    ) : (
                      tCommon("loadMore")
                    )}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
