"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import AssetImage from "@/components/AssetImage";
import { Search, Filter, Star, Heart, ExternalLink } from "lucide-react";
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
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [rating, setRating] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState("relevance");

  const categoryOptions = [{ value: "", label: "All Categories" }, ...categories];
  const storeOptions = [{ value: "", label: "All Stores" }, ...stores];

  const sortOptions = [
    { value: "relevance", label: "Relevance" },
    { value: "price_low", label: "Price: Low to High" },
    { value: "price_high", label: "Price: High to Low" },
    { value: "rating", label: "Rating" },
  ];

  const ratingOptions = [
    { value: "", label: "All Ratings" },
    { value: "4", label: "4+ Stars" },
    { value: "3", label: "3+ Stars" },
    { value: "2", label: "2+ Stars" },
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
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t("title")}</h1>
          <p className="text-gray-400">
            {initialQuery ? `${t("subtitle")} "${initialQuery}"` : t("noResults")}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 sticky top-24">
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
                  Clear
                </Button>
              </div>

              <form onSubmit={handleSearch} className="space-y-6">
                <Input
                  label={t("searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                />

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
                  {t("filter")}
                </Button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-6">
              <span className="text-gray-400">{filteredResults.length} results found</span>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredResults.map((product) => (
                  <Card key={product.id} hover>
                    <div className="space-y-4">
                      <div className="py-4 flex justify-center">
                        <AssetImage
                          src={product.imageSrc}
                          alt=""
                          width={96}
                          height={96}
                          className="deal-product-img"
                          fallback={<span className="text-6xl">{product.emoji}</span>}
                        />
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1">{product.name}</h3>
                        <p className="text-sm text-gray-400">
                          {product.category} • {product.store}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        <span>{product.rating}</span>
                        <span>({product.reviewCount} reviews)</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-white">${product.price}</span>
                        {product.originalPrice > product.price && (
                          <span className="text-gray-500 line-through">${product.originalPrice}</span>
                        )}
                        {product.discount > 0 && (
                          <span className="bg-green-500/20 text-green-400 text-sm font-bold px-2 py-1 rounded">
                            -{product.discount}%
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm ${product.inStock ? "text-green-400" : "text-red-400"}`}
                        >
                          {product.inStock ? t("inStock") : t("outOfStock")}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <Button className="flex-1">{t("viewDetails")}</Button>
                        <Button variant="outline" size="sm">
                          <Heart className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
