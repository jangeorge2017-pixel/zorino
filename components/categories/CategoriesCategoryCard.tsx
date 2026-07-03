"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import { ArrowRight } from "lucide-react";
import type { Category } from "@/lib/types/entities";

type CategoriesCategoryCardProps = {
  category: Category;
  viewLabel: string;
  variant?: "grid" | "list";
};

export default function CategoriesCategoryCard({
  category,
  viewLabel,
  variant = "grid",
}: CategoriesCategoryCardProps) {
  if (variant === "list") {
    return (
      <article className="zor-categories-page__card zor-categories-page__card--list">
        <span className="zor-categories-page__card-icon" aria-hidden>
          {category.icon ?? "📦"}
        </span>
        <div className="zor-categories-page__card-body">
          <h3 className="zor-categories-page__card-title">{category.name}</h3>
          <p className="zor-categories-page__card-count">
            {category.productCount.toLocaleString()} products
          </p>
        </div>
        <Link href={`/categories/${category.slug}`}>
          <Button variant="outline" size="sm">
            {viewLabel}
            <ArrowRight size={14} aria-hidden />
          </Button>
        </Link>
      </article>
    );
  }

  return (
    <article className="zor-categories-page__card">
      <span className="zor-categories-page__card-icon" aria-hidden>
        {category.icon ?? "📦"}
      </span>
      <h3 className="zor-categories-page__card-title">{category.name}</h3>
      <p className="zor-categories-page__card-count">
        {category.productCount.toLocaleString()} products
      </p>
      <Link href={`/categories/${category.slug}`} className="zor-categories-page__card-link">
        <Button variant="outline" size="sm" className="w-full">
          {viewLabel}
          <ArrowRight size={14} aria-hidden />
        </Button>
      </Link>
    </article>
  );
}
