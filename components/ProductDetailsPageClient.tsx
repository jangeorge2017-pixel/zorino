"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import AssetImage from "@/components/AssetImage";
import {
  Star,
  Heart,
  Share2,
  ExternalLink,
  TrendingUp,
  CheckCircle,
  Plus,
  Minus,
} from "lucide-react";
import type { ProductDetail } from "@/lib/data/product-detail";

type ProductDetailsPageClientProps = {
  detail: ProductDetail;
};

export default function ProductDetailsPageClient({ detail }: ProductDetailsPageClientProps) {
  const t = useTranslations("product");
  const { product, categoryName, price, originalPrice, discount, stores } = detail;
  const [quantity, setQuantity] = useState(1);
  const [selectedStore, setSelectedStore] = useState(0);
  const [activeTab, setActiveTab] = useState("description");

  const tabs = [
    { id: "description", label: t("description") },
    { id: "details", label: t("specifications") },
    { id: "reviews", label: t("reviews") },
  ];

  const detailRows = [
    product.brand ? ["Brand", product.brand] : null,
    ["Category", categoryName],
    product.currency ? ["Currency", product.currency] : null,
    product.countryCode ? ["Country", product.countryCode] : null,
    ...(product.tags.length > 0 ? [["Tags", product.tags.join(", ")]] : []),
  ].filter(Boolean) as [string, string][];

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-sm text-gray-400 mb-6">
          <Link href="/" className="hover:text-white">
            Home
          </Link>
          {" > "}
          <Link href="/categories" className="hover:text-white">
            {categoryName}
          </Link>
          {" > "}
          <span className="text-white">{product.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
          <div>
            <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 mb-4 flex justify-center">
              <AssetImage
                src={product.imageUrl}
                alt={product.name}
                width={240}
                height={240}
                className="deal-product-img"
                fallback={<span className="text-9xl">{product.emoji ?? "🛍️"}</span>}
              />
            </div>
          </div>

          <div>
            <div className="mb-4">
              <span className="bg-purple-500/20 text-purple-400 text-sm font-medium px-3 py-1 rounded-full">
                {categoryName}
              </span>
            </div>

            <h1 className="text-3xl font-bold text-white mb-4">{product.name}</h1>

            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500 fill-current" />
                <span className="text-white font-semibold">{product.rating ?? 4.5}</span>
                <span className="text-gray-400">({product.reviewCount} reviews)</span>
              </div>
              <span className={`text-sm ${product.inStock ? "text-green-400" : "text-red-400"}`}>
                {product.inStock ? t("inStock") : t("outOfStock")}
              </span>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <span className="text-4xl font-bold text-white">${price}</span>
              {originalPrice > price && (
                <span className="text-2xl text-gray-500 line-through">${originalPrice}</span>
              )}
              {discount > 0 && (
                <span className="bg-green-500/20 text-green-400 text-lg font-bold px-3 py-1 rounded">
                  -{discount}%
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 mb-8">
              <div className="flex items-center border border-gray-700 rounded-lg">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-4 py-2 text-white hover:bg-gray-800 transition-colors"
                  type="button"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-6 py-2 text-white font-semibold">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-4 py-2 text-white hover:bg-gray-800 transition-colors"
                  type="button"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <Button className="flex-1">{t("addToCart")}</Button>
              <Button variant="outline">
                <Heart className="w-5 h-5" />
              </Button>
              <Button variant="outline">
                <Share2 className="w-5 h-5" />
              </Button>
            </div>

            <Card>
              <h3 className="text-lg font-semibold text-white mb-4">{t("availableAt")}</h3>
              {stores.length === 0 ? (
                <p className="text-gray-400 text-sm">No store prices listed yet.</p>
              ) : (
                <div className="space-y-3">
                  {stores.map((store, index) => (
                    <div
                      key={store.id}
                      className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-colors ${
                        selectedStore === index
                          ? "bg-purple-500/20 border border-purple-500"
                          : "bg-gray-800/50 border border-gray-700 hover:border-gray-600"
                      }`}
                      onClick={() => setSelectedStore(index)}
                    >
                      <div className="flex items-center gap-3">
                        <AssetImage
                          src={store.logoUrl ?? ""}
                          alt=""
                          width={32}
                          height={32}
                          className="rounded-lg"
                          fallback={
                            <span className="text-lg font-bold text-purple-300">
                              {store.logoInitial}
                            </span>
                          }
                        />
                        <div>
                          <p className="text-white font-medium">{store.name}</p>
                          <p className="text-sm text-gray-400">
                            {store.inStock ? t("inStock") : t("outOfStock")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold">${store.price}</p>
                        {store.originalPrice > store.price && (
                          <p className="text-sm text-gray-500 line-through">
                            ${store.originalPrice}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {stores[selectedStore]?.externalUrl && (
                <Link href={stores[selectedStore].externalUrl!} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full mt-4 flex items-center justify-center gap-2">
                    {t("comparePrices")}
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </Link>
              )}
            </Card>
          </div>
        </div>

        <div className="mb-12">
          <div className="flex gap-4 mb-6 border-b border-gray-800">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-4 px-4 font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-purple-400 border-b-2 border-purple-400"
                    : "text-gray-400 hover:text-white"
                }`}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-8">
            {activeTab === "description" && (
              <p className="text-gray-300 leading-relaxed">
                {product.description ?? "No description available."}
              </p>
            )}

            {activeTab === "details" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {detailRows.map(([key, value]) => (
                  <div key={key} className="flex justify-between py-3 border-b border-gray-800">
                    <span className="text-gray-400">{key}</span>
                    <span className="text-white font-medium">{value}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "reviews" && (
              <div className="text-center py-8">
                <div className="flex items-center justify-center gap-4 mb-4">
                  <div className="text-5xl font-bold text-white">{product.rating ?? 4.5}</div>
                  <div>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-5 h-5 ${
                            i < Math.floor(product.rating ?? 4.5)
                              ? "text-yellow-500 fill-current"
                              : "text-gray-600"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-gray-400">{product.reviewCount} reviews</p>
                  </div>
                </div>
                <p className="text-gray-400 mb-4">Reviews will appear here once users submit them.</p>
                <Button>{t("writeReview")}</Button>
              </div>
            )}
          </div>
        </div>

        <Card className="flex items-center gap-4">
          <TrendingUp className="w-8 h-8 text-green-400" />
          <div>
            <p className="text-white font-semibold flex items-center gap-2">
              Price tracking active
              <CheckCircle className="w-4 h-4 text-green-400" />
            </p>
            <p className="text-sm text-gray-400">We monitor prices across partner stores in real time.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
