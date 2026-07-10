"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import { ArrowLeft } from "lucide-react";
import type { MockCategoryDetail } from "@/lib/mock/types";

type CategoryDetailHeroProps = {
  detail: MockCategoryDetail;
  categoriesLabel: string;
};

export default function CategoryDetailHero({ detail, categoriesLabel }: CategoryDetailHeroProps) {
  const { category, description } = detail;

  return (
    <section className="zor-categories-page__detail-hero" aria-labelledby="category-detail-title">
      <div className="zor-categories-page__hero-glow" aria-hidden />
      <Link href="/categories" className="zor-categories-page__back">
        <ArrowLeft size={14} aria-hidden />
        {categoriesLabel}
      </Link>

      <div className="zor-categories-page__detail-inner">
        <div className="zor-categories-page__detail-brand">
          <span className="zor-categories-page__detail-icon" aria-hidden>{category.icon ?? "📦"}</span>
          <div>
            <p className="zor-categories-page__eyebrow">Category spotlight</p>
            <h1 id="category-detail-title" className="zor-categories-page__title">
              {category.name}
            </h1>
            <p className="zor-categories-page__subtitle">{description}</p>
          </div>
        </div>

        <div className="zor-categories-page__stats zor-categories-page__detail-stats">
          <div className="zor-categories-page__stat zor-categories-page__stat--hot">
            <div>
              <strong>{category.productCount.toLocaleString("en-US")}</strong>
              <span>Products tracked</span>
            </div>
          </div>
          <div className="zor-categories-page__stat">
            <div>
              <strong>Live</strong>
              <span>Updated daily</span>
            </div>
          </div>
        </div>

        <Link href="/search" className="zor-categories-page__detail-search">
          <Button>Search in {category.name}</Button>
        </Link>
      </div>
    </section>
  );
}
