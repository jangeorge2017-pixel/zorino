"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import AssetImage from "@/components/AssetImage";
import PriceComparisonTable, { ComparePriceSummary } from "@/components/PriceComparisonTable";
import Card from "@/components/ui/Card";
import { PageEmptyState, PageHeader, PageLayout } from "@/components/pages";
import type { CompareProductResult } from "@/services/compare";

type ComparePageClientProps = {
  products: CompareProductResult[];
};

export default function ComparePageClient({ products }: ComparePageClientProps) {
  const t = useTranslations("compare");

  return (
    <PageLayout>
      <PageHeader
        title={t("title")}
        subtitle="Compare prices across Amazon, AliExpress, eBay, Walmart and more"
      />

      {products.length === 0 ? (
        <PageEmptyState
          title={t("noProductsToCompare")}
          description="Browse products and add them to compare prices across stores."
          actionLabel="Browse Products"
          onAction={() => {
            window.location.href = "/products";
          }}
        />
      ) : (
        <div className="space-y-10">
          {products.map((item) => (
            <Card key={item.product.id} className="compare-page-product">
              <div className="compare-page-product-header">
                <div className="compare-page-product-media product-card-media">
                  <div className="product-card-image-frame">
                    <AssetImage
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      fill
                      className="compare-page-product-img product-card-image"
                      sizes="120px"
                      fallback={<span className="deal-emoji">{item.product.emoji ?? "🛍️"}</span>}
                    />
                  </div>
                </div>
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
    </PageLayout>
  );
}
