"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import AssetImage from "@/components/AssetImage";
import PriceComparisonTable, { ComparePriceSummary } from "@/components/PriceComparisonTable";
import Card from "@/components/ui/Card";
import type { CompareProductResult } from "@/services/compare";

type ComparePageClientProps = {
  products: CompareProductResult[];
};

export default function ComparePageClient({ products }: ComparePageClientProps) {
  const t = useTranslations("compare");

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white mb-2">{t("title")}</h1>
        <p className="text-gray-400">
          Compare prices across Amazon, AliExpress, eBay, Walmart and Temu
        </p>
      </div>

      {products.length === 0 ? (
        <Card>
          <p className="text-gray-400">{t("noProductsToCompare")}</p>
          <Link href="/" className="text-purple-400 hover:text-purple-300 text-sm mt-4 inline-block">
            Browse products →
          </Link>
        </Card>
      ) : (
        <div className="space-y-10">
          {products.map((item) => (
            <Card key={item.product.id} className="compare-page-product">
              <div className="compare-page-product-header">
                <AssetImage
                  src={item.product.imageUrl}
                  alt=""
                  width={64}
                  height={64}
                  className="compare-page-product-img"
                  fallback={<span className="text-3xl">{item.product.emoji ?? "🛍️"}</span>}
                />
                <div>
                  <Link
                    href={`/product/${item.product.id}#compare-prices`}
                    className="text-xl font-bold text-white hover:text-purple-300"
                  >
                    {item.product.name}
                  </Link>
                  <p className="text-sm text-gray-400 mt-1">
                    {item.providerCount} stores · from ${item.lowestPrice.toLocaleString("en-US")}
                  </p>
                </div>
              </div>

              <ComparePriceSummary
                lowestPrice={item.lowestPrice}
                highestDiscount={item.highestDiscount}
                providerCount={item.providerCount}
                cheapestStoreName={item.cheapestStoreName}
                savingsVsHighest={item.savingsVsHighest}
              />

              <PriceComparisonTable offers={item.offers} productId={item.product.id} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
