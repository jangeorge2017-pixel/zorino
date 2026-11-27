"use client";

import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import StoreLogo from "@/components/StoreLogo";
import { ExternalLink } from "lucide-react";
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
  return (
    <article className="zor-stores-page__card">
      <div className="zor-stores-page__card-head">
        <div className="zor-stores-page__card-logo">
          <StoreLogo
            slug={store.slug}
            name={store.name}
            logoUrl={store.logoUrl}
            logoInitial={store.logoInitial}
            alt={store.name}
            className="zor-stores-page__card-logo-img"
            fallbackClassName="zor-stores-page__card-logo-fallback"
          />
        </div>
        <div className="zor-stores-page__card-title-wrap">
          <h3 className="zor-stores-page__card-title">
            {store.name}
          </h3>
          <span className="zor-stores-page__card-badge">{store.integrationType}</span>
        </div>
      </div>

      <div className="zor-stores-page__card-rating">
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
        <a
          href={`/api/affiliate/go?productId=store-${encodeURIComponent(store.slug)}&store=${encodeURIComponent(store.slug)}&to=${encodeURIComponent(store.website)}&source=stores`}
          target="_blank"
          rel="nofollow sponsored noopener noreferrer"
        >
          <Button variant="outline" className="zor-stores-page__card-visit">
            <ExternalLink size={14} aria-hidden />
            {visitLabel}
          </Button>
        </a>
      </div>
    </article>
  );
}
