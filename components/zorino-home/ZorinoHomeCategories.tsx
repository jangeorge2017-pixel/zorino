import { getTranslations } from "next-intl/server";
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

export default async function ZorinoHomeCategories({
  categories,
}: ZorinoHomeCategoriesProps) {
  const t = await getTranslations("home");
  // Never hide the shortcut row — fall back to the canonical 8 tiles.
  const items =
    categories.length > 0
      ? categories
      : [
          { slug: "phones", label: "Phones", active: false, accent: "blue" },
          { slug: "laptops", label: "Laptops", active: false, accent: "cyan" },
          { slug: "gaming", label: "Gaming", active: false, accent: "purple" },
          { slug: "tvs", label: "TVs", active: false, accent: "orange" },
          { slug: "home", label: "Home", active: true, accent: "green" },
          { slug: "wearables", label: "Wearables", active: false, accent: "pink" },
          { slug: "fashion", label: "Fashion", active: false, accent: "indigo" },
          { slug: "more", label: "More", active: false, accent: "gray" },
        ];

  return (
    <nav className="zh-categories-nav" id="zh-section-categories" aria-label={t("categoriesNav")}>
      <div className="zh-categories">
        {items.map((category) => {
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
