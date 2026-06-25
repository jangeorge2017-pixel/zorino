"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import AssetImage from "@/components/AssetImage";
import PriceComparisonTable, { ComparePriceSummary } from "@/components/PriceComparisonTable";
import {
  Star,
  Heart,
  Share2,
  ExternalLink,
  TrendingUp,
  CheckCircle,
} from "lucide-react";
import type { ProductDetail } from "@/lib/data/product-detail";
import { buildAffiliateRedirectPath } from "@/lib/affiliate/generate";
import { trackProductInteraction } from "@/lib/trending/track-client";

type ProductDetailsPageClientProps = {
  detail: ProductDetail;
};

export default function ProductDetailsPageClient({ detail }: ProductDetailsPageClientProps) {
  const t = useTranslations("product");
  const { product, categoryName, comparison } = detail;
  const { offers, lowestPrice, highestDiscount, providerCount, cheapestStoreName, savingsVsHighest } =
    comparison;

  const cheapest = offers.find((o) => o.isLowest) ?? offers[0];
  const price = lowestPrice || cheapest?.price || 0;
  const originalPrice = cheapest?.originalPrice ?? price;
  const discount =
    originalPrice > 0
      ? Math.max(0, Math.round(((originalPrice - price) / originalPrice) * 100))
      : highestDiscount;

  useEffect(() => {
    trackProductInteraction({
      productId: product.id,
      eventType: "view",
      countryCode: product.countryCode ?? "US",
      source: "product_detail",
    });
  }, [product.id, product.countryCode]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#compare-prices") {
      document.getElementById("compare-prices")?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const trackClick = (source: string) => {
    trackProductInteraction({
      productId: product.id,
      eventType: "click",
      countryCode: product.countryCode ?? "US",
      source,
    });
  };

  const detailRows = [
    product.brand ? ["Brand", product.brand] : null,
    ["Category", categoryName],
    ["Stores compared", String(providerCount || offers.length)],
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
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="bg-purple-500/20 text-purple-400 text-sm font-medium px-3 py-1 rounded-full">
                {categoryName}
              </span>
              {providerCount >= 2 && (
                <span className="bg-green-500/20 text-green-400 text-sm font-medium px-3 py-1 rounded-full">
                  {providerCount} stores compared
                </span>
              )}
              {cheapestStoreName && (
                <span className="bg-blue-500/20 text-blue-400 text-sm font-medium px-3 py-1 rounded-full">
                  Cheapest at {cheapestStoreName}
                </span>
              )}
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
              <span className="text-4xl font-bold text-white">${price.toLocaleString("en-US")}</span>
              {originalPrice > price && (
                <span className="text-2xl text-gray-500 line-through">
                  ${originalPrice.toLocaleString("en-US")}
                </span>
              )}
              {discount > 0 && (
                <span className="bg-green-500/20 text-green-400 text-lg font-bold px-3 py-1 rounded">
                  -{discount}%
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 mb-8">
              <Link href="#compare-prices" className="deal-compare-btn flex-1 text-center">
                Compare Prices
              </Link>
              <Button variant="outline">
                <Heart className="w-5 h-5" />
              </Button>
              <Button variant="outline">
                <Share2 className="w-5 h-5" />
              </Button>
            </div>

            {offers.length > 0 && (
              <ComparePriceSummary
                lowestPrice={lowestPrice}
                highestDiscount={highestDiscount}
                providerCount={providerCount}
                cheapestStoreName={cheapestStoreName}
                savingsVsHighest={savingsVsHighest}
              />
            )}
          </div>
        </div>

        <section id="compare-prices" className="mb-12 scroll-mt-24">
          <Card>
            <h2 className="text-2xl font-bold text-white mb-2">Compare Prices</h2>
            <p className="text-gray-400 text-sm mb-6">
              Prices from Amazon, AliExpress, eBay, Walmart and Temu — updated every 4 hours
            </p>
            {offers.length === 0 ? (
              <p className="text-gray-400 text-sm">No store prices listed yet.</p>
            ) : (
              <PriceComparisonTable
                offers={offers}
                productId={product.id}
                onShopClick={(store) => trackClick(`product_compare_${store}`)}
              />
            )}
            {cheapest?.externalUrl && (
              <Link
                href={buildAffiliateRedirectPath({
                  productId: product.id,
                  storeSlug: cheapest.store?.slug ?? cheapest.provider ?? "store",
                  destinationUrl: cheapest.externalUrl,
                  source: "product_detail_cheapest",
                  countryCode: product.countryCode ?? "US",
                })}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackClick("product_detail_cheapest")}
              >
                <Button className="w-full mt-6 flex items-center justify-center gap-2">
                  Shop cheapest at {cheapestStoreName}
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </Link>
            )}
          </Card>
        </section>

        <div className="mb-12">
          <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-8">
            <h3 className="text-lg font-semibold text-white mb-4">{t("description")}</h3>
            <p className="text-gray-300 leading-relaxed mb-6">
              {product.description ?? "No description available."}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {detailRows.map(([key, value]) => (
                <div key={key} className="flex justify-between py-3 border-b border-gray-800">
                  <span className="text-gray-400">{key}</span>
                  <span className="text-white font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Card className="flex items-center gap-4">
          <TrendingUp className="w-8 h-8 text-green-400" />
          <div>
            <p className="text-white font-semibold flex items-center gap-2">
              Price tracking active
              <CheckCircle className="w-4 h-4 text-green-400" />
            </p>
            <p className="text-sm text-gray-400">
              We compare prices across Amazon, AliExpress, eBay, Walmart and Temu every 4 hours.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
