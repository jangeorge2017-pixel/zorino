"use client";

import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import { ComparePricesButton } from "@/components/PriceComparisonTable";

type ProductCardActionsProps = {
  productId: string;
  shopHref?: string;
  showShop?: boolean;
  compareOnly?: boolean;
  onShopClick?: () => void;
  shopExternal?: boolean;
};

/** Shop Now primary + Compare Prices secondary, or Compare Prices only (reference deals). */
export default function ProductCardActions({
  productId,
  shopHref,
  showShop = true,
  compareOnly = false,
  onShopClick,
  shopExternal = false,
}: ProductCardActionsProps) {
  const t = useTranslations("common");
  // A missing merchant URL must leave the product unshoppable. In particular,
  // do not turn "Shop Now" into an internal ZORINO product/compare URL.
  const showShopButton = showShop && !compareOnly && shopExternal && Boolean(shopHref);

  return (
    <div className="product-card-actions-group">
      <div
        className={`product-card-actions${showShopButton ? " product-card-actions-dual" : " product-card-actions-single"}`}
      >
        {showShopButton ? (
          <a
            href={shopHref}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            className="home-shop-btn"
            onClick={onShopClick}
          >
            {t("shopNow")}
            <ExternalLink size={16} />
          </a>
        ) : null}
        <ComparePricesButton productId={productId} className="home-compare-btn" />
      </div>
      <p className="product-card-disclosure">
        {t("affiliateDisclosure")}
      </p>
    </div>
  );
}
