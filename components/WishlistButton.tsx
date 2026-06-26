"use client";

import { useCallback, useEffect, useState } from "react";
import { Heart } from "lucide-react";

const STORAGE_KEY = "zorino_wishlist_guest";

function readGuestWishlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeGuestWishlist(ids: string[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

type WishlistButtonProps = {
  productId: string;
  className?: string;
};

export default function WishlistButton({ productId, className }: WishlistButtonProps) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(readGuestWishlist().includes(productId));
  }, [productId]);

  const toggle = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const ids = readGuestWishlist();
      const next = ids.includes(productId)
        ? ids.filter((id) => id !== productId)
        : [...ids, productId];
      writeGuestWishlist(next);
      setActive(next.includes(productId));
    },
    [productId],
  );

  return (
    <button
      type="button"
      className={`product-wishlist-btn${active ? " is-active" : ""}${className ? ` ${className}` : ""}`}
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={active}
      onClick={toggle}
    >
      <Heart size={16} fill={active ? "currentColor" : "none"} />
    </button>
  );
}
