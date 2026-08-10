"use client";

import { useEffect } from "react";
import HeroFloatingCard from "@/components/zorino-home/HeroFloatingCard";
import type { FloatingProductCard } from "@/lib/types/entities";

const HERO_ORBIT_COMPOSITION = [
  "orbit-top",
  "orbit-upper-left",
  "orbit-upper-right",
  "orbit-lower-right",
] as const;

/** Tablet band only — Desktop / Mobile keep orbit composition. */
const TABLET_MQ = "(min-width: 768px) and (max-width: 1279px)";

type HeroArtworkProps = {
  floatingProducts: FloatingProductCard[];
};

export default function HeroArtwork({ floatingProducts }: HeroArtworkProps) {
  const byPosition = new Map(
    floatingProducts.map((product) => [product.position, product]),
  );
  const orbitCards = HERO_ORBIT_COMPOSITION.map(
    (position) => byPosition.get(position),
  ).filter((product): product is FloatingProductCard => product != null);

  useEffect(() => {
    const mq = window.matchMedia(TABLET_MQ);
    let orbitParent: Element | null = null;
    let nextSibling: ChildNode | null = null;

    const restore = (card: HTMLElement) => {
      card.style.width = "";
      card.style.height = "";
      if (orbitParent && card.parentElement !== orbitParent) {
        if (nextSibling && nextSibling.parentNode === orbitParent) {
          orbitParent.insertBefore(card, nextSibling);
        } else {
          orbitParent.appendChild(card);
        }
      }
    };

    const sync = () => {
      const card = document.querySelector<HTMLElement>(
        '.zh-page .zh-orbit-card[data-orbit-position="orbit-top"]',
      );
      const stats = document.querySelector<HTMLElement>(".zh-page .zh-hero__stats");
      const sample = stats?.querySelector<HTMLElement>(".zh-stat");
      if (!card || !stats || !sample) return;

      if (!orbitParent) {
        orbitParent = card.parentElement;
        nextSibling = card.nextSibling;
      }

      if (!mq.matches) {
        restore(card);
        return;
      }

      /* Host under stats for positioning only — never mutate .zh-stat nodes */
      if (card.parentElement !== stats) {
        stats.appendChild(card);
      }

      /* Metric cards are the master size; floating card adapts to them */
      const { width, height } = sample.getBoundingClientRect();
      card.style.width = `${Math.round(width)}px`;
      card.style.height = `${Math.round(height)}px`;
    };

    sync();
    mq.addEventListener("change", sync);
    window.addEventListener("resize", sync);

    const stats = document.querySelector(".zh-page .zh-hero__stats");
    const ro = stats ? new ResizeObserver(sync) : null;
    if (stats && ro) {
      ro.observe(stats);
      for (const el of stats.querySelectorAll(".zh-stat")) {
        ro.observe(el);
      }
    }

    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
      ro?.disconnect();
      const card = document.querySelector<HTMLElement>(
        '.zh-page .zh-orbit-card[data-orbit-position="orbit-top"]',
      );
      if (card) restore(card);
    };
  }, [floatingProducts]);

  return (
    <div className="hero-artwork" aria-hidden="true">
      {orbitCards.length > 0 ? (
        <div className="hero-artwork__orbit" aria-label="Featured products">
          {orbitCards.map((product) => (
            <HeroFloatingCard
              key={product.position}
              product={product}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
