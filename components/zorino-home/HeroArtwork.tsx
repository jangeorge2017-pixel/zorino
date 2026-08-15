"use client";

import { useEffect, useRef } from "react";
import HeroFloatingCard from "@/components/zorino-home/HeroFloatingCard";
import { MOBILE_NORMAL_MQ } from "@/components/zorino-home/MobileNormalRowMore";
import type { FloatingProductCard } from "@/lib/types/entities";

const HERO_ORBIT_COMPOSITION = [
  "orbit-top",
  "orbit-upper-left",
  "orbit-upper-right",
  "orbit-lower-right",
] as const;

/**
 * Desktop + Tablet park a single floating deal card beside the stats.
 * Tablet (768–1279) parks BOTH existing orbit-top cards (hero artwork + the
 * post-categories artwork) into the stats row, side by side after the metrics.
 * Desktop (≥1280) parks the same two orbit-top cards AND the primary artwork's
 * lower-right card — three animated cards total in the stats row, every card
 * the same size (matched to a live .zh-stat square).
 * The second artwork rotates its product pool (rotateOrbitProducts) so its
 * parked card shows a different image than the first; the extra lower-right
 * card is a third distinct existing product.
 * Mobile (portrait + Mobile Normal) relocates the full 4-card orbit strip
 * after Search; portrait hides the second artwork so exactly 4 distinct
 * product cards show in the strip.
 */
const STATS_ORBIT_MQ = "(min-width: 768px)";

const DESKTOP_ORBIT_MQ = "(min-width: 1280px)";

/* Portrait + Mobile Normal — matches the shared ≤767 mobile CSS block. */
const MOBILE_ORBIT_MQ =
  "(max-width: 767px), (max-height: 500px) and (orientation: landscape) and (max-width: 1024px)";

type HeroArtworkProps = {
  floatingProducts: FloatingProductCard[];
  /**
   * Tablet parks this artwork's orbit-top card beside the metrics. When the
   * two artworks park side by side, the second instance must show a DIFFERENT
   * product image than the first — rotate the shared pool so its orbit-top
   * card is a distinct existing product, never the same image on both cards.
   */
  rotateOrbitProducts?: boolean;
};

type OrbitSlotCard = {
  position: (typeof HERO_ORBIT_COMPOSITION)[number];
  product: FloatingProductCard;
};

export default function HeroArtwork({
  floatingProducts,
  rotateOrbitProducts = false,
}: HeroArtworkProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const byPosition = new Map(
    floatingProducts.map((product) => [product.position, product]),
  );
  const slotProducts = HERO_ORBIT_COMPOSITION.map(
    (position) => byPosition.get(position),
  ).filter((product): product is FloatingProductCard => product != null);

  /* Rotate so the new orbit-top is the first real product after the original
     top slot (skips degraded/empty slots). Only applied when a distinct real
     product exists — otherwise both artworks fall back to the same pool. */
  const alternateIndex = rotateOrbitProducts
    ? slotProducts.findIndex((product, index) => index > 0 && product.imageSrc)
    : -1;
  const orbitPool =
    alternateIndex > 0
      ? [
          ...slotProducts.slice(alternateIndex),
          ...slotProducts.slice(0, alternateIndex),
        ]
      : slotProducts;

  const orbitCards = HERO_ORBIT_COMPOSITION.map((position, index) => {
    const product = orbitPool[index];
    if (!product) return null;
    return {
      position,
      product:
        product.position === position ? product : { ...product, position },
    };
  }).filter(
    (entry): entry is OrbitSlotCard => entry != null,
  );

  /* Desktop + Tablet: park this artwork's orbit-top card under the stats row,
   * side by side after the metrics. Desktop also parks the primary artwork's
   * lower-right card as a third animated card. Portrait + Mobile Normal keep
   * all cards in the post-Search strip. */
  useEffect(() => {
    const rootEl = rootRef.current;
    if (!rootEl) return;
    const mq = window.matchMedia(STATS_ORBIT_MQ);
    const desktopMq = window.matchMedia(DESKTOP_ORBIT_MQ);
    const mobileNormalMq = window.matchMedia(MOBILE_NORMAL_MQ);
    const parkOrigin = new Map<
      HTMLElement,
      { parent: Element | null; next: ChildNode | null }
    >();

    const restore = (card: HTMLElement) => {
      card.style.width = "";
      card.style.height = "";
      const origin = parkOrigin.get(card);
      if (origin?.parent && card.parentElement !== origin.parent) {
        if (origin.next && origin.next.parentNode === origin.parent) {
          origin.parent.insertBefore(card, origin.next);
        } else {
          origin.parent.appendChild(card);
        }
      }
    };

    const sizeToStat = (card: HTMLElement, sample: HTMLElement) => {
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

    const parkCard = (
      card: HTMLElement,
      stats: HTMLElement,
      sample: HTMLElement,
    ) => {
      if (!parkOrigin.has(card)) {
        parkOrigin.set(card, {
          parent: card.parentElement,
          next: card.nextSibling,
        });
      }
      /* Host under stats for positioning only — never mutate .zh-stat nodes */
      if (card.parentElement !== stats) {
        stats.appendChild(card);
      }
      sizeToStat(card, sample);
    };

    const sync = () => {
      /* Only this artwork's own cards are ever moved — never another
         instance's subtree (its Suspense boundary may hydrate later than ours,
         so moving its nodes early would break hydration and duplicate cards). */
      const stats = document.querySelector<HTMLElement>(".zh-page .zh-hero__stats");
      const sample = stats?.querySelector<HTMLElement>(".zh-stat");
      if (!stats || !sample) return;

      const card = rootEl.querySelector<HTMLElement>(
        '.zh-orbit-card[data-orbit-position="orbit-top"]',
      );
      const extra = rootEl.querySelector<HTMLElement>(
        '.zh-orbit-card[data-orbit-position="orbit-lower-right"]',
      );

      /* The hero artwork is always first in the DOM; the post-categories
         artwork parks beside the metrics on Tablet and Desktop. Short
         landscape (≥768 wide) still matches STATS_ORBIT via min-width —
         Mobile Normal owns the orbit there, so never park into stats. */
      const isPrimary = rootEl === document.querySelector(".zh-page .hero-artwork");
      const parkTop = !mobileNormalMq.matches && mq.matches;
      const parkExtra = parkTop && isPrimary && desktopMq.matches;

      if (!parkTop) {
        if (card) restore(card);
        if (extra) restore(extra);
        return;
      }

      if (card) parkCard(card, stats, sample);

      if (parkExtra) {
        if (extra) parkCard(extra, stats, sample);
      } else if (extra) {
        restore(extra);
      }
    };

    sync();
    mq.addEventListener("change", sync);
    desktopMq.addEventListener("change", sync);
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
      desktopMq.removeEventListener("change", sync);
      mobileNormalMq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
      ro?.disconnect();
      for (const card of rootEl.querySelectorAll<HTMLElement>(".zh-orbit-card")) {
        if (parkOrigin.has(card)) restore(card);
      }
    };
  }, [floatingProducts]);

  /* Mobile (portrait + Mobile Normal): move the full 4-card orbit strip
   * under Search — between the Search bar and the Categories row. */
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_ORBIT_MQ);
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
      orbit.classList.remove("zh-hero-orbit-in-strip");
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
      orbit.classList.add("zh-hero-orbit-in-strip");

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
    <div ref={rootRef} className="hero-artwork" aria-hidden="true">
      {orbitCards.length > 0 ? (
        <div className="hero-artwork__orbit" aria-label="Featured products">
          {orbitCards.map(({ position, product }) => (
            <HeroFloatingCard
              key={position}
              product={product}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
