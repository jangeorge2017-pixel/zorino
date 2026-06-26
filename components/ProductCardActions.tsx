import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { ComparePricesButton } from "@/components/PriceComparisonTable";

type ProductCardActionsProps = {
  productId: string;
  shopHref?: string;
  showShop?: boolean;
  compareClassName?: string;
  onShopClick?: () => void;
  shopExternal?: boolean;
};

/** Aligned Compare Prices + Shop Now row shared across product cards. */
export default function ProductCardActions({
  productId,
  shopHref,
  showShop = true,
  compareClassName,
  onShopClick,
  shopExternal = false,
}: ProductCardActionsProps) {
  const href = shopHref ?? `/product/${productId}#compare-prices`;

  return (
    <div
      className={`product-card-actions${showShop ? " product-card-actions-dual" : " product-card-actions-single"}`}
    >
      <ComparePricesButton
        productId={productId}
        className={compareClassName ?? "deal-compare-btn"}
      />
      {showShop ? (
        shopExternal ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="lowest-price-shop"
            onClick={onShopClick}
          >
            Shop Now
            <ExternalLink size={16} />
          </a>
        ) : (
          <Link href={href} className="lowest-price-shop" onClick={onShopClick}>
            Shop Now
            <ExternalLink size={16} />
          </Link>
        )
      ) : null}
    </div>
  );
}
