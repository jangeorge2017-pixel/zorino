"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import { ArrowLeft, CheckCircle, ExternalLink, Tag } from "lucide-react";
import { resolveStoreLogoSrc } from "@/lib/assets";
import type { MockStoreDetail } from "@/lib/mock/types";

type StoreDetailHeroProps = {
  detail: MockStoreDetail;
};

export default function StoreDetailHero({ detail }: StoreDetailHeroProps) {
  const { store, description, productCount, dealsCount, couponsCount } = detail;
  const logoSrc = store.logoUrl || resolveStoreLogoSrc(store.slug);

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
            {logoSrc ? (
              <Image src={logoSrc} alt={store.name} fill className="zor-stores-page__card-logo-img" unoptimized />
            ) : (
              <span className="zor-stores-page__card-logo-fallback">{store.logoInitial}</span>
            )}
          </div>
          <div>
            <p className="zor-stores-page__eyebrow">
              <CheckCircle size={14} aria-hidden />
              Partner store
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
          {dealsCount > 0 ? (
            <div className="zor-stores-page__stat zor-stores-page__stat--hot">
              <span className="zor-stores-page__stat-icon" aria-hidden><Tag size={15} /></span>
              <div><strong>{dealsCount}</strong><span>Active deals</span></div>
            </div>
          ) : null}
          <div className="zor-stores-page__stat">
            <span className="zor-stores-page__stat-icon" aria-hidden><Tag size={15} /></span>
            <div><strong>{couponsCount}</strong><span>Coupons</span></div>
          </div>
        </div>

        {store.website ? (
          <a
            href={`/api/affiliate/go?productId=store-${encodeURIComponent(store.slug)}&store=${encodeURIComponent(store.slug)}&to=${encodeURIComponent(store.website)}&source=stores`}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            className="zor-stores-page__detail-visit"
          >
            <Button variant="outline">
              <ExternalLink size={14} aria-hidden />
              Visit Store
            </Button>
          </a>
        ) : null}
      </div>
    </section>
  );
}

