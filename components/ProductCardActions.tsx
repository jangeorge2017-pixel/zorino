import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { ComparePricesButton } from "@/components/PriceComparisonTable";

type ProductCardActionsProps = {
  productId: string;
  shopHref?: string;
  showShop?: boolean;
  onShopClick?: () => void;
  shopExternal?: boolean;
};

/** Shop Now primary + Compare Prices secondary. */
export default function ProductCardActions({
  productId,
  shopHref,
  showShop = true,
  onShopClick,
  shopExternal = false,
}: ProductCardActionsProps) {
  const href = shopHref ?? `/product/${productId}#compare-prices`;

  return (
    <div
      className={`product-card-actions${showShop ? " product-card-actions-dual" : " product-card-actions-single"}`}
    >
      {showShop ? (
        shopExternal ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="home-shop-btn"
            onClick={onShopClick}
          >
            Shop Now
            <ExternalLink size={16} />
          </a>
        ) : (
          <Link href={href} className="home-shop-btn" onClick={onShopClick}>
            Shop Now
            <ExternalLink size={16} />
          </Link>
        )
      ) : null}
      <ComparePricesButton productId={productId} className="home-compare-btn" />
    </div>
  );
}
