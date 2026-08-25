"use client";

import Link from "next/link";
import AssetImage from "@/components/AssetImage";
import Button from "@/components/ui/Button";
import PriceComparisonTable, { ComparePriceSummary } from "@/components/PriceComparisonTable";
import { useIntlPreferences } from "@/components/international/IntlPreferencesProvider";
import { useTranslations } from "next-intl";
import type { CompareProductResult } from "@/services/compare";
import { ArrowRight } from "lucide-react";

type CompareProductCardProps = {
  item: CompareProductResult;
  viewLabel?: string;
};

export default function CompareProductCard({
  item,
  viewLabel,
}: CompareProductCardProps) {
  const t = useTranslations("compare");
  const { formatPrice } = useIntlPreferences();
  const viewLabelText = viewLabel ?? t("viewFullComparison");

  return (
    <article className="zor-compare-page__card">
      <div className="zor-compare-page__card-head">
        <div className="zor-compare-page__card-media">
          <AssetImage
            src={item.product.imageUrl}
            alt={item.product.name}
            fill
            className="zor-compare-page__card-img"
            sizes="96px"
            fallback={<span className="zor-compare-page__card-emoji">{item.product.emoji ?? "🛍️"}</span>}
          />
        </div>
        <div className="zor-compare-page__card-copy">
          <Link href={`/product/${item.product.id}#compare-prices`} className="zor-compare-page__card-title">
            {item.product.name}
          </Link>
          <p className="zor-compare-page__card-meta-line">
            {t("productsCount", { count: item.providerCount })} ·{" "}
            {t("priceFrom", { price: formatPrice(item.lowestPrice) })}
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

      <Link href={`/product/${item.product.id}#compare-prices`} className="zor-compare-page__card-link">
        <Button variant="outline" size="sm" className="w-full">
          {viewLabelText}
          <ArrowRight size={14} aria-hidden />
        </Button>
      </Link>
    </article>
  );
}
