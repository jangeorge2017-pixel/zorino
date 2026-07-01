import Link from "next/link";
import { ChevronDown } from "lucide-react";
import ZorinoHomeDealCard from "@/components/zorino-home/ZorinoHomeDealCard";
import type { ZhHomeProductSection } from "@/lib/zorino-home/sections";
import type { TrendingDealCard } from "@/lib/types/entities";
import "./zorino-home-product-sections.css";

type ZorinoHomeProductSectionProps = {
  section: ZhHomeProductSection;
  products: TrendingDealCard[];
};

export default function ZorinoHomeProductSection({
  section,
  products,
}: ZorinoHomeProductSectionProps) {
  const titleId = `${section.targetId}-title`;

  return (
    <section
      className="zh-panel zh-product-section"
      id={section.targetId}
      aria-labelledby={titleId}
    >
      <div className="zh-section-head">
        <h2 id={titleId} className="zh-section-head__title">
          <span aria-hidden>{section.icon}</span>
          {section.title}
        </h2>
        <Link href={section.viewAllHref} className="zh-section-head__link">
          {section.viewAllLabel}
          <ChevronDown size={14} aria-hidden />
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="zh-panel__empty">No products in this section right now. Check back soon.</p>
      ) : (
        <div className="zh-product-grid">
          {products.map((product) => (
            <ZorinoHomeDealCard key={product.id} deal={product} />
          ))}
        </div>
      )}
    </section>
  );
}
