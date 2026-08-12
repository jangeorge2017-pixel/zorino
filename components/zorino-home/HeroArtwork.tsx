"use client";

import { useEffect } from "react";
import HeroFloatingCard from "@/components/zorino-home/HeroFloatingCard";
import { MOBILE_NORMAL_MQ } from "@/components/zorino-home/MobileNormalRowMore";
import type { FloatingProductCard } from "@/lib/types/entities";

const HERO_ORBIT_COMPOSITION = [
  "orbit-top",
  "orbit-upper-left",
  "orbit-upper-right",
  "orbit-lower-right",
] as const;

/** Tablet + Desktop + Portrait Mobile — single floating deal card beside stats.
 *  Mobile Normal (landscape) relocates the full orbit strip after Search. */
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

  /* Tablet / Desktop / Portrait: park orbit-top under the stats row.
   * Skip Mobile Normal — that mode keeps all 4 cards in the post-Search strip. */
  useEffect(() => {
    const mq = window.matchMedia(STATS_ORBIT_MQ);
    const mobileNormalMq = window.matchMedia(MOBILE_NORMAL_MQ);
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

      /* Short landscape (≥768 wide) still matches STATS_ORBIT via min-width —
         Mobile Normal owns the orbit there, so never park into stats. */
      if (mobileNormalMq.matches || !mq.matches) {
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
    mobileNormalMq.addEventListener("change", sync);
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
      mobileNormalMq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
      ro?.disconnect();
      const card = document.querySelector<HTMLElement>(
        '.zh-page .zh-orbit-card[data-orbit-position="orbit-top"]',
      );
      if (card) restore(card);
    };
  }, [floatingProducts]);

  /* Mobile Normal only: move the full 4-card orbit strip under Search */
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_NORMAL_MQ);
    let orbitParent: Element | null = null;
    let nextSibling: ChildNode | null = null;

    const clearCardSizes = (orbit: HTMLElement) => {
      for (const card of orbit.querySelectorAll<HTMLElement>(".zh-orbit-card")) {
        card.style.width = "";
        card.style.height = "";
      }
    };

    const restore = (orbit: HTMLElement) => {
      clearCardSizes(orbit);
      if (orbitParent && orbit.parentElement !== orbitParent) {
        if (nextSibling && nextSibling.parentNode === orbitParent) {
          orbitParent.insertBefore(orbit, nextSibling);
        } else {
          orbitParent.appendChild(orbit);
        }
      }
    };

    const sync = () => {
      const orbit = document.querySelector<HTMLElement>(
        ".zh-page .hero-artwork__orbit",
      );
      const search = document.querySelector<HTMLElement>(".zh-page .zh-hero-search");
      if (!orbit || !search) return;

      if (!orbitParent) {
        orbitParent = orbit.parentElement;
        nextSibling = orbit.nextSibling;
      }

      if (!mq.matches) {
        restore(orbit);
        return;
      }

      if (orbit.previousElementSibling !== search) {
        search.insertAdjacentElement("afterend", orbit);
      }

      const cards = orbit.querySelectorAll<HTMLElement>(".zh-orbit-card");
      if (cards.length === 0) return;
      const gap = 8;
      const width = orbit.clientWidth || search.clientWidth;
      const side = Math.max(
        44,
        Math.floor((width - gap * Math.max(0, cards.length - 1)) / cards.length),
      );
      for (const card of cards) {
        card.style.width = `${side}px`;
        card.style.height = `${side}px`;
      }
    };

    sync();
    mq.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    const search = document.querySelector(".zh-page .zh-hero-search");
    const ro = search ? new ResizeObserver(sync) : null;
    if (search && ro) ro.observe(search);

    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
      ro?.disconnect();
      const orbit = document.querySelector<HTMLElement>(
        ".zh-page .hero-artwork__orbit",
      );
      if (orbit) restore(orbit);
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
