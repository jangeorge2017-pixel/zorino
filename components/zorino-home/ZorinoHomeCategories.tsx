"use client";

import { Link } from "@/i18n/navigation";
import {
  Gamepad2,
  Home,
  Laptop,
  MoreHorizontal,
  Shirt,
  Smartphone,
  Tv,
  Watch,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { HomepageCategoryItem } from "@/lib/types/entities";
import "./categories.css";

const ICONS = {
  phones: Smartphone,
  laptops: Laptop,
  gaming: Gamepad2,
  tvs: Tv,
  home: Home,
  wearables: Watch,
  fashion: Shirt,
  more: MoreHorizontal,
} as const;

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  phones: "catPhones",
  laptops: "catLaptops",
  gaming: "catGaming",
  tvs: "catTvs",
  home: "catHome",
  wearables: "catWearables",
  fashion: "catFashion",
  more: "catMore",
};

type ZorinoHomeCategoriesProps = {
  categories: HomepageCategoryItem[];
};

export default function ZorinoHomeCategories({ categories }: ZorinoHomeCategoriesProps) {
  const t = useTranslations("home");

  if (categories.length === 0) return null;

  return (
    <nav className="zh-categories-nav" id="zh-section-categories" aria-label={t("categoriesNav")}>
      <div className="zh-categories">
        {categories.map((category) => {
          const Icon = ICONS[category.slug as keyof typeof ICONS] ?? MoreHorizontal;
          const href =
            category.slug === "more" ? "/categories" : `/categories/${category.slug}`;
          const accent = category.accent ? ` zh-categories__item--${category.accent}` : "";
          const highlighted =
            category.active || category.slug === "home"
              ? " zh-categories__item--highlight"
              : "";
          const labelKey = CATEGORY_LABEL_KEYS[category.slug];
          const label = labelKey ? t(labelKey as "catPhones") : category.label;

          return (
            <Link
              key={category.slug}
              href={href}
              className={`zh-categories__item${accent}${highlighted}`}
            >
              <span className="zh-categories__icon-box">
                <Icon size={28} strokeWidth={1.75} aria-hidden />
              </span>
              <span className="zh-categories__label">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
