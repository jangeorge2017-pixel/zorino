"use client";

import { Clock } from "lucide-react";
import ListingProductCard from "@/components/ListingProductCard";
import type { Deal } from "@/lib/types/entities";

type DealsDealCardProps = {
  deal: Deal;
  endsInLabel: string;
  featuredLabel?: string;
};

export default function DealsDealCard({
  deal,
  endsInLabel,
  featuredLabel,
}: DealsDealCardProps) {
  return (
    <div className="zor-deals-page__card">
      <ListingProductCard
        product={{
          id: deal.product?.id ?? deal.id,
          name: deal.product?.name ?? deal.title,
          imageSrc: deal.product?.imageUrl ?? "",
          emoji: deal.product?.emoji ?? undefined,
          price: deal.price,
          originalPrice: deal.originalPrice,
          discount: Math.round(deal.discount),
          rating: deal.product?.rating ?? undefined,
          reviewCount: deal.product?.reviewCount ?? undefined,
          store: deal.store?.name ?? undefined,
          storeSlug: deal.store?.slug ?? undefined,
        }}
        showWishlist={false}
        featuredLabel={deal.isFeatured ? featuredLabel : undefined}
      />
      <p className="listing-deal-meta">
        <Clock size={14} aria-hidden />
        {endsInLabel}
      </p>
    </div>
  );
}
