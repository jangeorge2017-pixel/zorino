"use client";

import { useRef } from "react";
import { useLocale } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";

type DealsCarouselProps = {
  children: React.ReactNode;
};

export default function DealsCarousel({ children }: DealsCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const locale = useLocale();

  const scroll = (direction: -1 | 1) => {
    const node = scrollRef.current;
    if (!node) return;
    const cardWidth = node.querySelector(".home-product-card")?.clientWidth ?? 280;
    const rtlFactor = locale === "ar" ? -1 : 1;
    node.scrollBy({ left: direction * rtlFactor * (cardWidth + 14), behavior: "smooth" });
  };

  return (
    <div className="deals-carousel ref-deals-carousel">
      <button
        type="button"
        className="deals-nav deals-nav-prev"
        aria-label="Previous deals"
        onClick={() => scroll(-1)}
      >
        <ChevronLeft size={18} strokeWidth={2.25} />
      </button>
      <div className="deals-grid deals-grid--carousel" ref={scrollRef}>
        {children}
      </div>
      <button
        type="button"
        className="deals-nav deals-nav-next"
        aria-label="Next deals"
        onClick={() => scroll(1)}
      >
        <ChevronRight size={18} strokeWidth={2.25} />
      </button>
    </div>
  );
}
