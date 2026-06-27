import Link from "next/link";
import {
  Smartphone,
  Laptop,
  Gamepad2,
  Tv,
  Home,
  Watch,
  Shirt,
  MoreHorizontal,
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
} as const;

type Props = {
  categories: HomepageCategoryItem[];
};

export default function ZorinoBlueprintCategories({ categories }: Props) {
  if (categories.length === 0) return null;

  return (
    <nav className="zb-categories" aria-label="Categories">
      {categories.map((category) => {
        const Icon =
          ICONS[category.slug as keyof typeof ICONS] ?? MoreHorizontal;
        const href =
          category.slug === "more" ? "/categories" : `/categories/${category.slug}`;
        const accent = category.accent ? ` zb-accent-${category.accent}` : "";
        const active = category.active ? " zb-category--active" : "";

        return (
          <Link
            key={category.slug}
            href={href}
            className={`zb-category${accent}${active}`}
          >
            <span className="zb-category-icon">
              <Icon size={22} strokeWidth={1.8} aria-hidden />
            </span>
            <span className="zb-category-label">{category.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
