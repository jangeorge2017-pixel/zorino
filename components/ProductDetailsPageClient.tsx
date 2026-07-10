"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { PageLayout } from "@/components/pages";
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
  const tCommon = useTranslations("common");
  const { product, categoryName, comparison, images, specifications, variants, priceHistory } =
    detail;
  const { offers, lowestPrice, highestDiscount, providerCount, cheapestStoreName, savingsVsHighest, savingsPercent } =
    comparison;

  const gallery = images.length > 0 ? images : [product.imageUrl];
  const [activeImage, setActiveImage] = useState(gallery[0]);

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
    product.brand ? [t("brand"), product.brand] : null,
    [t("category"), categoryName],
    [t("storesCompared"), String(providerCount || offers.length)],
    product.currency ? [t("currency"), product.currency] : null,
    product.countryCode ? [t("country"), product.countryCode] : null,
    ...(product.tags.length > 0 ? [[t("tags"), product.tags.join(", ")]] : []),
  ].filter(Boolean) as [string, string][];

  return (
    <PageLayout>
    <div>
        <div className="text-sm text-gray-400 mb-6">
          <Link href="/" className="hover:text-white">
            {t("breadcrumbHome")}
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
            <div className="product-detail-gallery product-card-media mb-4">
              <div className="product-card-image-frame">
                <AssetImage
                  src={activeImage}
                  alt={product.name}
                  fill
                  className="product-card-image"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                  fallback={<span className="deal-emoji">{product.emoji ?? "🛍️"}</span>}
                />
              </div>
            </div>
            {gallery.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {gallery.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setActiveImage(url)}
                    className={`shrink-0 rounded-lg border p-1 ${
                      activeImage === url ? "border-purple-500" : "border-gray-800"
                    }`}
                  >
                    <AssetImage src={url} alt="" width={64} height={64} className="rounded" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="bg-purple-500/20 text-purple-400 text-sm font-medium px-3 py-1 rounded-full">
                {categoryName}
              </span>
              {providerCount >= 2 && (
                <span className="bg-green-500/20 text-green-400 text-sm font-medium px-3 py-1 rounded-full">
                  {t("storesComparedCount", { count: providerCount })}
                </span>
              )}
              {cheapestStoreName && (
                <span className="bg-blue-500/20 text-blue-400 text-sm font-medium px-3 py-1 rounded-full">
                  {t("cheapestAt", { store: cheapestStoreName })}
                </span>
              )}
            </div>

            <h1 className="text-3xl font-bold text-white mb-4">{product.name}</h1>

            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500 fill-current" />
                <span className="text-white font-semibold">{product.rating ?? 4.5}</span>
                <span className="text-gray-400">
                  ({t("reviewsCount", { count: product.reviewCount })})
                </span>
              </div>
              <span className={`text-sm ${product.inStock ? "text-green-400" : "text-red-400"}`}>
                {product.inStock ? tCommon("inStock") : tCommon("outOfStock")}
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
                {t("comparePrices")}
              </Link>
              <Button variant="outline" aria-label={tCommon("addToWishlist")}>
                <Heart className="w-5 h-5" />
              </Button>
              <Button variant="outline" aria-label={t("shareProduct")}>
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
                savingsPercent={savingsPercent}
              />
            )}
          </div>
        </div>

        <section id="compare-prices" className="mb-12 scroll-mt-24">
          <Card>
            <h2 className="text-2xl font-bold text-white mb-2">{t("comparePrices")}</h2>
            <p className="text-gray-400 text-sm mb-6">{t("comparePricesSubtitle")}</p>
            {offers.length === 0 ? (
              <p className="text-gray-400 text-sm">{t("noStorePrices")}</p>
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
                  {t("shopCheapestAt", { store: cheapestStoreName })}
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
              {product.description ?? t("noDescription")}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {detailRows.map(([key, value]) => (
                <div key={key} className="flex justify-between py-3 border-b border-gray-800">
                  <span className="text-gray-400">{key}</span>
                  <span className="text-white font-medium">{value}</span>
                </div>
              ))}
              {Object.entries(specifications).map(([key, value]) => (
                <div key={key} className="flex justify-between py-3 border-b border-gray-800">
                  <span className="text-gray-400 capitalize">{key.replace(/_/g, " ")}</span>
                  <span className="text-white font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {variants.length > 0 && (
          <section className="mb-12">
            <Card>
              <h2 className="text-2xl font-bold text-white mb-4">{t("availableVariants")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {variants.map((variant) => (
                  <div
                    key={variant.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-gray-800 bg-gray-900/40"
                  >
                    <div>
                      <p className="text-white font-medium">{variant.name}</p>
                      <p className="text-xs text-gray-500">
                        {Object.entries(variant.attributes)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="text-right">
                      {variant.price != null && (
                        <p className="text-white font-semibold">
                          ${Number(variant.price).toLocaleString("en-US")}
                        </p>
                      )}
                      <p className={`text-xs ${variant.inStock ? "text-green-400" : "text-red-400"}`}>
                        {variant.inStock ? tCommon("inStock") : tCommon("outOfStock")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        )}

        {priceHistory.length > 1 && (
          <section className="mb-12">
            <Card>
              <h2 className="text-2xl font-bold text-white mb-4">{t("priceHistory")}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-800">
                      <th className="text-left py-2">{t("historyDate")}</th>
                      <th className="text-right py-2">{tCommon("price")}</th>
                      <th className="text-right py-2">{t("historyChange")}</th>
                      <th className="text-left py-2">{t("historySource")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...priceHistory].reverse().slice(0, 10).map((point) => (
                      <tr key={point.id} className="border-b border-gray-800/50">
                        <td className="py-2 text-gray-300">
                          {new Date(point.recordedAt).toLocaleDateString()}
                        </td>
                        <td className="py-2 text-right text-white">
                          ${point.price.toLocaleString("en-US")} {point.currency}
                        </td>
                        <td className="py-2 text-right">
                          {point.changeDirection === "down" && (
                            <span className="text-green-400">↓ {point.changePercent}%</span>
                          )}
                          {point.changeDirection === "up" && (
                            <span className="text-red-400">↑ {point.changePercent}%</span>
                          )}
                          {point.changeDirection === "new" && (
                            <span className="text-gray-400">{t("historyNew")}</span>
                          )}
                          {point.changeDirection === "same" && (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                        <td className="py-2 text-gray-400 capitalize">{point.provider ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>
        )}

        <Card className="flex items-center gap-4">
          <TrendingUp className="w-8 h-8 text-green-400" />
          <div>
            <p className="text-white font-semibold flex items-center gap-2">
              {t("priceTrackingActive")}
              <CheckCircle className="w-4 h-4 text-green-400" />
            </p>
            <p className="text-sm text-gray-400">{t("priceTrackingDescription")}</p>
          </div>
        </Card>
    </div>
    </PageLayout>
  );
}
