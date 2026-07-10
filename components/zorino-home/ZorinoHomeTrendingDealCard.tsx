"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import AssetImage from "@/components/AssetImage";
import { ChevronRight, Clock, Star } from "lucide-react";
import TrendingDealBadge from "@/components/zorino-home/TrendingDealBadge";
import type { TrendingDealCard } from "@/lib/types/entities";
import type { TrendingDealDisplayBadge } from "@/lib/zorino-home/trending-deals-section";
import "./ZorinoHomeTrendingDealCard.css";

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

type ZorinoHomeTrendingDealCardProps = {
  deal: TrendingDealCard & { displayBadge: TrendingDealDisplayBadge };
  priority?: boolean;
};

export default function ZorinoHomeTrendingDealCard({
  deal,
  priority = false,
}: ZorinoHomeTrendingDealCardProps) {
  const t = useTranslations("home");
  const tCommon = useTranslations("common");
  const compareHref = deal.productId ? `/product/${deal.productId}` : "/deals";
  const hasDiscount = deal.discount > 0 && deal.originalPrice > deal.price;

  return (
    <article className="zh-td-card">
      <div className="zh-td-card__media">
        <TrendingDealBadge badge={deal.displayBadge} />
        {hasDiscount ? (
          <span className="zh-td-card__discount">-{Math.round(deal.discount)}%</span>
        ) : null}
        <AssetImage
          src={deal.imageSrc || ""}
          alt={deal.name}
          fill
          sizes="(max-width: 767px) 85vw, 280px"
          priority={priority}
          className="zh-td-card__image"
        />
      </div>

      <div className="zh-td-card__body">
        <h3 className="zh-td-card__title">{deal.name}</h3>

        <div className="zh-td-card__prices">
          <span className="zh-td-card__price">{formatUsd(deal.price)}</span>
          {hasDiscount ? (
            <span className="zh-td-card__was">{formatUsd(deal.originalPrice)}</span>
          ) : null}
        </div>

        <div className="zh-td-card__store-row">
          <span className="zh-td-card__store-logo" aria-hidden>
            <AssetImage src={deal.storeLogoSrc || ""} alt="" width={24} height={24} />
          </span>
          <span className="zh-td-card__store">{deal.store}</span>
        </div>

        <div className="zh-td-card__rating">
          <span
            className="zh-td-card__stars"
            aria-label={t("outOfStars", { rating: deal.rating })}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={11}
                fill={i < Math.round(deal.rating) ? "#fbbf24" : "transparent"}
                color={i < Math.round(deal.rating) ? "#fbbf24" : "#475569"}
              />
            ))}
          </span>
          <span className="zh-td-card__rating-value">{deal.rating.toFixed(1)}</span>
          <span className="zh-td-card__reviews">
            ({deal.reviews.toLocaleString("en-US")})
          </span>
        </div>

        <p className="zh-td-card__updated">
          <Clock size={11} aria-hidden />
          {t("updatedMinsAgo", { mins: deal.updatedMins })}
        </p>
      </div>

      <Link href={compareHref} className="zh-td-card__cta">
        {tCommon("comparePrices")}
        <ChevronRight size={15} aria-hidden />
      </Link>
    </article>
  );
}
