import { Link } from "@/i18n/navigation";
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
  const href = shopHref ?? `/product/${productId}#compare-prices`;
  const showShopButton = showShop && !compareOnly;

  return (
    <div
      className={`product-card-actions${showShopButton ? " product-card-actions-dual" : " product-card-actions-single"}`}
    >
      {showShopButton ? (
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
