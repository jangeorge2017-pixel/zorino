import { Link } from "@/i18n/navigation";
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

const iconMap = {
  phones: Smartphone,
  laptops: Laptop,
  gaming: Gamepad2,
  tvs: Tv,
  home: Home,
  wearables: Watch,
  fashion: Shirt,
} as const;

type CategoryGridProps = {
  categories: HomepageCategoryItem[];
};

export default function CategoryGrid({ categories }: CategoryGridProps) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <section className="categories-section">
      <div className="categories">
        {categories.map((category) => {
          const Icon =
            iconMap[category.slug as keyof typeof iconMap] ?? MoreHorizontal;
          const href = category.slug === "more" ? "/categories" : `/categories/${category.slug}`;

          return (
            <Link
              key={category.slug}
              href={href}
              className={`category-card ${category.active ? "category-card-active" : ""} ${category.accent ? `category-accent-${category.accent}` : ""}`}
            >
              <span className="category-icon-wrap">
                <Icon size={22} strokeWidth={1.8} />
              </span>
              <span className="category-label">{category.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
