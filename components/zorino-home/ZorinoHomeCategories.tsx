import Link from "next/link";
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
import type { HomepageCategoryItem } from "@/lib/types/entities";

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

type ZorinoHomeCategoriesProps = {
  categories: HomepageCategoryItem[];
};

export default function ZorinoHomeCategories({ categories }: ZorinoHomeCategoriesProps) {
  if (categories.length === 0) return null;

  return (
    <nav className="zh-categories" aria-label="Categories">
      {categories.map((category) => {
        const Icon = ICONS[category.slug as keyof typeof ICONS] ?? MoreHorizontal;
        const href =
          category.slug === "more" ? "/categories" : `/categories/${category.slug}`;
        const accent = category.accent ? ` zh-categories__item--${category.accent}` : "";
        const highlighted =
          category.active || category.slug === "home" ? " zh-categories__item--highlight" : "";

        return (
          <Link
            key={category.slug}
            href={href}
            className={`zh-categories__item${accent}${highlighted}`}
          >
            <span className="zh-categories__icon">
              <Icon size={17} strokeWidth={1.85} aria-hidden />
            </span>
            <span className="zh-categories__label">{category.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
