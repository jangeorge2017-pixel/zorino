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

/**
 * Tablet + Desktop + Portrait Mobile (Tablet UI mode) — single floating card
 * beside stats. Short Mobile Landscape keeps the orbit DOM in place (no move).
 */
const STATS_ORBIT_MQ =
  "(min-width: 768px), ((max-width: 767px) and (orientation: portrait))";

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
    const mq = window.matchMedia(STATS_ORBIT_MQ);
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

      /* Stats height is the master; square frame + ~15% larger than the
         matched stat side so product art reads clearly on D+T. */
      const { width, height } = sample.getBoundingClientRect();
      const side = Math.max(
        1,
        Math.round(Math.min(width, height) * 1.15),
      );
      card.style.width = `${side}px`;
      card.style.height = `${side}px`;
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
