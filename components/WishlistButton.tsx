"use client";

import { useCallback, useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { isWishlisted, subscribeToWishlist, toggleWishlistItem } from "@/lib/wishlist/storage";
import type { WishlistSnapshotItem } from "@/lib/wishlist/types";

type WishlistButtonProps = {
  productId: string;
  /** Snapshot saved with the item so the wishlist page can render it. */
  item?: Omit<WishlistSnapshotItem, "addedAt">;
  className?: string;
};

export default function WishlistButton({ productId, item, className }: WishlistButtonProps) {
  const tCommon = useTranslations("common");
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(isWishlisted(productId));
    return subscribeToWishlist(() => setActive(isWishlisted(productId)));
  }, [productId]);

  const toggle = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!item) return;
      const added = toggleWishlistItem(item);
      setActive(added);
    },
    [item],
  );

  return (
    <button
      type="button"
      className={`product-wishlist-btn${active ? " is-active" : ""}${className ? ` ${className}` : ""}`}
      aria-label={active ? tCommon("removeFromWishlist") : tCommon("addToWishlist")}
      aria-pressed={active}
      onClick={toggle}
    >
      <Heart size={16} fill={active ? "currentColor" : "none"} />
    </button>
  );
}
