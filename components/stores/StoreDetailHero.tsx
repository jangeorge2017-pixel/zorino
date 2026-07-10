"use client";

import Image from "next/image";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { ArrowLeft, CheckCircle, ExternalLink, Star, Tag } from "lucide-react";
import type { MockStoreDetail } from "@/lib/mock/types";

type StoreDetailHeroProps = {
  detail: MockStoreDetail;
};

export default function StoreDetailHero({ detail }: StoreDetailHeroProps) {
  const { store, description, productCount, avgRating, dealsCount, couponsCount } = detail;

  return (
    <section className="zor-stores-page__detail-hero" aria-labelledby="store-detail-title">
      <div className="zor-stores-page__hero-glow" aria-hidden />
      <Link href="/stores" className="zor-stores-page__back">
        <ArrowLeft size={14} aria-hidden />
        All Stores
      </Link>

      <div className="zor-stores-page__detail-inner">
        <div className="zor-stores-page__detail-brand">
          <div className="zor-stores-page__detail-logo">
            {store.logoUrl ? (
              <Image src={store.logoUrl} alt={store.name} fill className="zor-stores-page__card-logo-img" unoptimized />
            ) : (
              <span className="zor-stores-page__card-logo-fallback">{store.logoInitial}</span>
            )}
          </div>
          <div>
            <p className="zor-stores-page__eyebrow">
              <CheckCircle size={14} aria-hidden />
              Verified partner
            </p>
            <h1 id="store-detail-title" className="zor-stores-page__title">
              {store.name}
            </h1>
            <p className="zor-stores-page__subtitle">{description}</p>
          </div>
        </div>

        <div className="zor-stores-page__stats zor-stores-page__detail-stats">
          <div className="zor-stores-page__stat">
            <span className="zor-stores-page__stat-icon" aria-hidden><Tag size={15} /></span>
            <div><strong>{productCount.toLocaleString("en-US")}</strong><span>Products</span></div>
          </div>
          <div className="zor-stores-page__stat zor-stores-page__stat--hot">
            <span className="zor-stores-page__stat-icon" aria-hidden><Star size={15} /></span>
            <div><strong>{avgRating}</strong><span>Rating</span></div>
          </div>
          <div className="zor-stores-page__stat">
            <span className="zor-stores-page__stat-icon" aria-hidden><Tag size={15} /></span>
            <div><strong>{dealsCount}</strong><span>Active deals</span></div>
          </div>
          <div className="zor-stores-page__stat">
            <span className="zor-stores-page__stat-icon" aria-hidden><Tag size={15} /></span>
            <div><strong>{couponsCount}</strong><span>Coupons</span></div>
          </div>
        </div>

        <Link href={store.website} target="_blank" rel="noopener noreferrer" className="zor-stores-page__detail-visit">
          <Button variant="outline">
            <ExternalLink size={14} aria-hidden />
            Visit Store
          </Button>
        </Link>
      </div>
    </section>
  );
}
