"use client";

import { useCallback } from "react";
import { Share2 } from "lucide-react";

type ShareButtonProps = {
  productId: string;
  productName: string;
};

export default function ShareButton({ productId, productName }: ShareButtonProps) {
  const handleShare = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const url = `${window.location.origin}/product/${productId}`;

      try {
        if (navigator.share) {
          await navigator.share({ title: productName, url });
          return;
        }
        await navigator.clipboard.writeText(url);
      } catch {
        /* user cancelled or clipboard blocked */
      }
    },
    [productId, productName],
  );

  return (
    <button
      type="button"
      className="product-share-btn"
      aria-label={`Share ${productName}`}
      onClick={handleShare}
    >
      <Share2 size={15} />
    </button>
  );
}
