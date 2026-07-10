"use client";

import { useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import { CheckCircle, ExternalLink, Star } from "lucide-react";
import { PRODUCT_IMAGE_PLACEHOLDER } from "@/lib/images/product-image";
import type { Store } from "@/lib/types/entities";

type StoresStoreCardProps = {
  store: Store;
  viewProductsLabel: string;
  visitLabel?: string;
};

export default function StoresStoreCard({
  store,
  viewProductsLabel,
  visitLabel = "Visit",
}: StoresStoreCardProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = Boolean(store.logoUrl) && !logoFailed;

  return (
    <article className="zor-stores-page__card">
      <div className="zor-stores-page__card-head">
        <div className="zor-stores-page__card-logo">
          {showLogo ? (
            <Image
              src={store.logoUrl!}
              alt={store.name}
              fill
              className="zor-stores-page__card-logo-img"
              unoptimized
              onError={() => setLogoFailed(true)}
            />
          ) : store.logoUrl && logoFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={PRODUCT_IMAGE_PLACEHOLDER}
              alt=""
              className="zor-stores-page__card-logo-img"
              style={{ objectFit: "contain", width: "100%", height: "100%" }}
            />
          ) : (
            <span className="zor-stores-page__card-logo-fallback">
              {store.logoInitial ?? store.name.slice(0, 2)}
            </span>
          )}
        </div>
        <div className="zor-stores-page__card-title-wrap">
          <h3 className="zor-stores-page__card-title">
            {store.name}
            <CheckCircle className="zor-stores-page__card-verified" size={16} aria-hidden />
          </h3>
          <span className="zor-stores-page__card-badge">{store.integrationType}</span>
        </div>
      </div>

      <div className="zor-stores-page__card-rating">
        <Star size={14} aria-hidden />
        <strong>4.5</strong>
        <span>Partner store</span>
      </div>

      <div className="zor-stores-page__card-meta">
        <div>
          <span>Commission</span>
          <strong>{store.commissionRate}%</strong>
        </div>
        <div>
          <span>Regions</span>
          <strong>{store.supportedRegions.length || "—"}</strong>
        </div>
      </div>

      <p className="zor-stores-page__card-url">
        <ExternalLink size={14} aria-hidden />
        {store.website}
      </p>

      <div className="zor-stores-page__card-actions">
        <Link href={`/stores/${store.slug}`} className="zor-stores-page__card-action-link">
          <Button className="w-full">{viewProductsLabel}</Button>
        </Link>
        <a href={store.website} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" className="zor-stores-page__card-visit">
            <ExternalLink size={14} aria-hidden />
            {visitLabel}
          </Button>
        </a>
      </div>
    </article>
  );
}
