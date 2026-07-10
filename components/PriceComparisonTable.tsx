"use client";

"use client";

import { useTranslations } from "next-intl";
import { ExternalLink, Tag, TrendingDown, Trophy, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import AssetImage from "@/components/AssetImage";
import { buildAffiliateRedirectPath } from "@/lib/affiliate/generate";
import type { CompareOffer } from "@/services/compare";

type PriceComparisonTableProps = {
  offers: CompareOffer[];
  productId: string;
  onShopClick?: (storeName: string) => void;
};

export default function PriceComparisonTable({
  offers,
  productId,
  onShopClick,
}: PriceComparisonTableProps) {
  const t = useTranslations("product");
  const tCommon = useTranslations("common");

  if (offers.length === 0) return null;

  return (
    <div className="price-comparison-wrap">
      <table className="price-comparison-table">
        <thead>
          <tr>
            <th scope="col">{t("tableStore")}</th>
            <th scope="col">{tCommon("price")}</th>
            <th scope="col">{tCommon("discount")}</th>
            <th scope="col">{t("tableStock")}</th>
            <th scope="col" className="price-comparison-action-col">
              {t("tableAction")}
            </th>
          </tr>
        </thead>
        <tbody>
          {offers.map((offer) => {
            const storeName = offer.store?.name ?? tCommon("stores");
            const storeSlug = offer.store?.slug ?? offer.provider ?? "store";
            const destination = offer.externalUrl ?? offer.store?.website ?? `/product/${productId}`;
            const shopUrl = buildAffiliateRedirectPath({
              productId,
              storeSlug,
              destinationUrl: destination,
              source: "compare_table",
            });
            return (
              <tr
                key={offer.id}
                className={offer.isLowest ? "price-comparison-row-cheapest" : undefined}
              >
                <td>
                  <div className="price-comparison-store">
                    <AssetImage
                      src={offer.store?.logoUrl ?? ""}
                      alt=""
                      width={28}
                      height={28}
                      className="price-comparison-store-logo"
                      fallback={
                        <span className="price-comparison-store-initial">
                          {offer.store?.logoInitial ?? storeName.slice(0, 2)}
                        </span>
                      }
                    />
                    <span>{storeName}</span>
                    {offer.isLowest && (
                      <span className="price-comparison-badge price-comparison-badge-cheapest">
                        <Trophy size={12} />
                        {t("cheapest")}
                      </span>
                    )}
                    {offer.isHighestDiscount && offer.discountPercent > 0 && (
                      <span className="price-comparison-badge price-comparison-badge-discount">
                        <Tag size={12} />
                        {t("bestDeal")}
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <span className="price-comparison-price">${offer.price.toLocaleString("en-US")}</span>
                  {(offer.originalPrice ?? 0) > offer.price && (
                    <span className="price-comparison-original">
                      ${(offer.originalPrice ?? offer.price).toLocaleString("en-US")}
                    </span>
                  )}
                </td>
                <td>
                  {offer.discountPercent > 0 ? (
                    <span className="price-comparison-discount">-{offer.discountPercent}%</span>
                  ) : (
                    <span className="price-comparison-no-discount">—</span>
                  )}
                </td>
                <td>
                  <span className={offer.inStock ? "price-comparison-in-stock" : "price-comparison-oos"}>
                    {offer.inStock ? tCommon("inStock") : tCommon("outOfStock")}
                  </span>
                </td>
                <td>
                  <a
                    href={shopUrl}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="price-comparison-shop-link"
                    onClick={() => onShopClick?.(storeName)}
                  >
                    {t("shop")}
                    <ExternalLink size={12} />
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type ComparePriceSummaryProps = {
  lowestPrice: number;
  highestDiscount: number;
  providerCount: number;
  cheapestStoreName: string;
  savingsVsHighest: number;
  savingsPercent?: number;
};

export function ComparePriceSummary({
  lowestPrice,
  highestDiscount,
  providerCount,
  cheapestStoreName,
  savingsVsHighest,
  savingsPercent,
}: ComparePriceSummaryProps) {
  const t = useTranslations("product");

  return (
    <div className="compare-price-summary">
      <div className="compare-price-stat">
        <span className="compare-price-stat-label">{t("lowestPrice")}</span>
        <span className="compare-price-stat-value">${lowestPrice.toLocaleString("en-US")}</span>
        <span className="compare-price-stat-meta">
          {t("atStore", { store: cheapestStoreName })}
        </span>
      </div>
      <div className="compare-price-stat">
        <span className="compare-price-stat-label">{t("highestDiscount")}</span>
        <span className="compare-price-stat-value">-{highestDiscount}%</span>
        <span className="compare-price-stat-meta">
          <TrendingDown size={14} />
          {t("acrossStores", { count: providerCount })}
        </span>
      </div>
      {savingsVsHighest > 0 && (
        <div className="compare-price-stat">
          <span className="compare-price-stat-label">{t("youSaveUpTo")}</span>
          <span className="compare-price-stat-value">${savingsVsHighest.toLocaleString("en-US")}</span>
          <span className="compare-price-stat-meta">
            {savingsPercent
              ? t("vsHighestPercent", { percent: savingsPercent })
              : t("vsHighest")}
          </span>
        </div>
      )}
    </div>
  );
}

export function ComparePricesButton({
  productId,
  className = "deal-compare-btn",
  onClick,
}: {
  productId: string;
  className?: string;
  onClick?: () => void;
}) {
  const t = useTranslations("product");

  return (
    <Link
      href={`/product/${productId}#compare-prices`}
      className={className}
      onClick={onClick}
    >
      {t("comparePrices")}
      <ChevronRight size={16} />
    </Link>
  );
}
