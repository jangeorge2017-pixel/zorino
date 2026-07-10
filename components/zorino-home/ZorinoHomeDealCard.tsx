"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ChevronRight, Clock, Star, TrendingDown, TrendingUp } from "lucide-react";
import AssetImage from "@/components/AssetImage";
import ZorinoHomeSparkline from "@/components/zorino-home/ZorinoHomeSparkline";
import type { TrendingDealCard } from "@/lib/types/entities";
import "./ZorinoHomeDealCard.css";

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function ZorinoHomeDealCard({ deal }: { deal: TrendingDealCard }) {
  const t = useTranslations("home");
  const tCommon = useTranslations("common");
  const dropped = deal.originalPrice > deal.price;
  const increased = deal.originalPrice < deal.price;
  const compareHref = deal.productId ? `/product/${deal.productId}` : "/deals";

  return (
    <article className="zh-deal-card">
      <div className="zh-deal-card__media">
        {deal.discount > 0 ? (
          <span className="zh-deal-card__discount">-{Math.round(deal.discount)}%</span>
        ) : null}
        <AssetImage
          src={deal.imageSrc || ""}
          alt={deal.name}
          fill
          sizes="(max-width: 767px) 85vw, 280px"
          className="zh-deal-card__image"
        />
      </div>

      <h3 className="zh-deal-card__name">{deal.name}</h3>

      <div className="zh-deal-card__rating">
        <span
          className="zh-deal-card__stars"
          aria-label={t("outOfStars", { rating: deal.rating })}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={11}
              fill={i < Math.round(deal.rating) ? "#fbbf24" : "#334155"}
              color={i < Math.round(deal.rating) ? "#fbbf24" : "#334155"}
            />
          ))}
        </span>
        <span className="zh-deal-card__reviews">
          ({deal.reviews.toLocaleString("en-US")})
        </span>
      </div>

      {dropped ? (
        <span className="zh-deal-card__drop">
          <TrendingDown size={12} aria-hidden />
          {t("priceDropped")}
        </span>
      ) : increased ? (
        <span className="zh-deal-card__rise">
          <TrendingUp size={12} aria-hidden />
          {t("priceUp")}
        </span>
      ) : null}

      <div className="zh-deal-card__prices">
        <span className="zh-deal-card__price">{formatUsd(deal.price)}</span>
        {(dropped || increased) && deal.originalPrice !== deal.price ? (
          <span className="zh-deal-card__was">{formatUsd(deal.originalPrice)}</span>
        ) : null}
      </div>

      <div className="zh-deal-card__store-row">
        <div className="zh-deal-card__store">
          <span className="zh-deal-card__store-logo">
            <AssetImage
              src={deal.storeLogoSrc || ""}
              alt=""
              width={24}
              height={24}
            />
          </span>
          {deal.store}
        </div>
        <span className="zh-deal-card__updated">
          <Clock size={11} aria-hidden />
          {t("updatedMinsAgo", { mins: deal.updatedMins })}
        </span>
      </div>

      <div className="zh-deal-card__spark-wrap">
        <ZorinoHomeSparkline values={deal.priceHistory} rising={increased} />
      </div>

      <Link href={compareHref} className="zh-deal-card__cta">
        {tCommon("comparePrices")}
        <ChevronRight size={16} aria-hidden />
      </Link>
    </article>
  );
}
