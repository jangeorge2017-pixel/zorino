import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  CircuitBoard,
  Dumbbell,
  Gamepad2,
  Headphones,
  Home,
  Laptop,
  Shirt,
  Smartphone,
  Sparkles,
  Tv,
  Watch,
} from "lucide-react";
import type { HomepageCategoryItem } from "@/lib/types/entities";
import { ZH_CATEGORIES } from "@/lib/zorino-home/content";
import "./categories.css";

const ICONS = {
  phones: Smartphone,
  laptops: Laptop,
  gaming: Gamepad2,
  tvs: Tv,
  home: Home,
  wearables: Watch,
  fashion: Shirt,
  electronics: CircuitBoard,
  audio: Headphones,
  beauty: Sparkles,
  sports: Dumbbell,
} as const;

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  phones: "catPhones",
  laptops: "catLaptops",
  gaming: "catGaming",
  tvs: "catTvs",
  home: "catHome",
  wearables: "catWearables",
  fashion: "catFashion",
  electronics: "catElectronics",
  audio: "catAudio",
  beauty: "catBeauty",
  sports: "catSports",
};

type ZorinoHomeCategoriesProps = {
  categories: HomepageCategoryItem[];
};

export default async function ZorinoHomeCategories({
  categories,
}: ZorinoHomeCategoriesProps) {
  const t = await getTranslations("home");
  // Prefer server list; fall back to full canonical row (no More tile).
  const items =
    categories.length > 0
      ? categories.filter((category) => category.slug !== "more")
      : ZH_CATEGORIES.map((category) => ({
          slug: category.slug,
          label: category.label,
          active: Boolean(category.highlighted),
          accent: category.accent ?? null,
        }));

  return (
    <nav className="zh-categories-nav" id="zh-section-categories" aria-label={t("categoriesNav")}>
      <div className="zh-categories">
        {items.map((category) => {
          const Icon = ICONS[category.slug as keyof typeof ICONS] ?? CircuitBoard;
          const href = `/categories/${category.slug}`;
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
