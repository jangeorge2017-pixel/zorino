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
import { categories } from "@/data/home";

const iconMap = {
  Phones: Smartphone,
  Laptops: Laptop,
  Gaming: Gamepad2,
  TVs: Tv,
  Home: Home,
  Wearables: Watch,
  Fashion: Shirt,
  More: MoreHorizontal,
} as const;

export default function CategoryGrid() {
  return (
    <section className="categories-section">
      <div className="categories">
        {categories.map((category) => {
          const Icon = iconMap[category.label as keyof typeof iconMap] ?? MoreHorizontal;
          return (
            <button
              key={category.label}
              type="button"
              className={`category-card ${category.active ? "category-card-active" : ""} ${category.accent ? `category-accent-${category.accent}` : ""}`}
            >
              <span className="category-icon-wrap">
                <Icon size={22} strokeWidth={1.8} />
              </span>
              <span className="category-label">{category.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
