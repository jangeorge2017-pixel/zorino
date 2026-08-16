"use client";

import { useLayoutEffect, useRef } from "react";
import HeroFloatingCard from "@/components/zorino-home/HeroFloatingCard";
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
 * Mobile portrait relocates the full 4-card orbit strip after Search;
 * portrait hides the second artwork so exactly 4 distinct product cards show
 * in the strip. Landscape phones render the Tablet UI as-is.
 */
const STATS_ORBIT_MQ =
  "(min-width: 768px), (max-width: 767px) and (orientation: landscape)";

const DESKTOP_ORBIT_MQ = "(min-width: 1280px)";

/* Mobile portrait only — landscape phones render the Tablet UI as-is. */
const MOBILE_ORBIT_MQ = "(max-width: 767px) and (orientation: portrait)";

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
   * lower-right card as a third animated card. Portrait keeps all cards in the
   * post-Search strip. */
  useLayoutEffect(() => {
    const rootEl = rootRef.current;
    if (!rootEl) return;
    const mq = window.matchMedia(STATS_ORBIT_MQ);
    const desktopMq = window.matchMedia(DESKTOP_ORBIT_MQ);
    const parkOrigin = new Map<
      HTMLElement,
      { parent: Element | null; next: ChildNode | null }
    >();
    /* Tracks every card this instance has parked. Once a card is appended to
       the stats row it leaves this artwork's subtree, so rootEl.querySelector
       can no longer see it — without this set, later sync() calls (resize,
       orientation/media-query change, route change) could never restore it and
       it would stay pinned to the stats row, overlapping the hero. */
    const parked = new Set<HTMLElement>();
    let extraParked: HTMLElement | null = null;

    const clearSize = (card: HTMLElement) => {
      card.style.width = "";
      card.style.height = "";
    };

    const restore = (card: HTMLElement) => {
      clearSize(card);
      const origin = parkOrigin.get(card);
      if (origin?.parent && card.parentElement !== origin.parent) {
        if (origin.next && origin.next.parentNode === origin.parent) {
          origin.parent.insertBefore(card, origin.next);
        } else {
          origin.parent.appendChild(card);
        }
      }
      parked.delete(card);
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
      parked.add(card);
    };

    /* A parked card lives under stats (outside this artwork's subtree), so
       prefer the tracked card and fall back to the subtree for the first park. */
    const findOrbitTop = () => {
      for (const card of parked) {
        if (card.dataset.orbitPosition === "orbit-top") return card;
      }
      return rootEl.querySelector<HTMLElement>(
        '.zh-orbit-card[data-orbit-position="orbit-top"]',
      );
    };

    const sync = () => {
      /* Only this artwork's own cards are ever moved — never another
         instance's subtree (its Suspense boundary may hydrate later than ours,
         so moving its nodes early would break hydration and duplicate cards). */
      const stats = document.querySelector<HTMLElement>(".zh-page .zh-hero__stats");
      const sample = stats?.querySelector<HTMLElement>(".zh-stat");
      if (!stats || !sample) return;

      const card = findOrbitTop();

      /* The hero artwork is always first in the DOM; the post-categories
         artwork parks beside the metrics on Tablet and Desktop. Landscape
         phones match STATS_ORBIT via their explicit clause and get the exact
         Tablet parking behavior. */
      const isPrimary = rootEl === document.querySelector(".zh-page .hero-artwork");
      const parkTop = mq.matches;
      const parkExtra = parkTop && isPrimary && desktopMq.matches;

      if (!parkTop) {
        if (card) restore(card);
        if (extraParked) {
          restore(extraParked);
          extraParked = null;
        }
        return;
      }

      if (card) parkCard(card, stats, sample);

      if (parkExtra) {
        /* Pick the extra animated card whose product image differs from the
           cards already parked in the row — the hero and post-categories
           artworks fetch their product pools independently, so the rotated
           pools can collide on the same product. */
        const candidates = [
          "orbit-lower-right",
          "orbit-upper-right",
          "orbit-upper-left",
        ] as const;
        let chosen: HTMLElement | null = null;
        for (const pos of candidates) {
          const el = rootEl.querySelector<HTMLElement>(
            `.zh-orbit-card[data-orbit-position="${pos}"]`,
          );
          if (!el) continue;
          const img = el.querySelector<HTMLImageElement>("img");
          if (img && img.getAttribute("src")) {
            let conflict = false;
            for (const other of stats.querySelectorAll<HTMLElement>(".zh-orbit-card")) {
              if (other === el) continue;
              const otherImg = other.querySelector<HTMLImageElement>("img");
              if (
                otherImg &&
                otherImg.getAttribute("src") === img.getAttribute("src")
              ) {
                conflict = true;
                break;
              }
            }
            if (conflict) continue;
          }
          chosen = el;
          break;
        }
        if (chosen) {
          if (extraParked && extraParked !== chosen) {
            restore(extraParked);
            extraParked = null;
          }
          parkCard(chosen, stats, sample);
          extraParked = chosen;
        } else if (extraParked) {
          restore(extraParked);
          extraParked = null;
        }
      } else if (extraParked) {
        restore(extraParked);
        extraParked = null;
      }
    };

    let ro: ResizeObserver | null = null;
    const attach = () => {
      const stats = document.querySelector(".zh-page .zh-hero__stats");
      if (!stats || ro) return;
      ro = new ResizeObserver(sync);
      ro.observe(stats);
      for (const el of stats.querySelectorAll(".zh-stat")) {
        ro.observe(el);
      }
    };

    sync();
    attach();
    mq.addEventListener("change", sync);
    desktopMq.addEventListener("change", sync);
    window.addEventListener("resize", sync);

    /* The artwork streams through its own Suspense boundary, so the stats row
       (and its .zh-stat cards) may not be in the DOM when this effect mounts.
       Pump sync until they exist (cold loads can take a while), then stop —
       observers handle everything else. */
    let intervalId: ReturnType<typeof setTimeout> | null = null;
    let tries = 0;
    const pump = () => {
      const stats = document.querySelector(".zh-page .zh-hero__stats");
      const sample = stats?.querySelector<HTMLElement>(".zh-stat");
      if (!stats || !sample) {
        tries += 1;
        if (tries <= 80) {
          intervalId = setTimeout(pump, 250);
        }
        return;
      }
      sync();
      attach();
    };
    intervalId = setTimeout(pump, 250);

    return () => {
      if (intervalId) clearTimeout(intervalId);
      mq.removeEventListener("change", sync);
      desktopMq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
      ro?.disconnect();
      for (const card of [...parked]) {
        restore(card);
      }
    };
  }, [floatingProducts]);

  /* Mobile portrait: move the full 4-card orbit strip under Search — between
   * the Search bar and the Categories row. Only the primary (hero) artwork
   * drives the strip; the second artwork is display:none in portrait. */
  useLayoutEffect(() => {
    const rootEl = rootRef.current;
    if (!rootEl) return;
    const mq = window.matchMedia(MOBILE_ORBIT_MQ);
    let orbitParent: Element | null = null;
    let nextSibling: ChildNode | null = null;
    /* The orbit is moved out of this artwork's subtree when the strip forms,
       so rootEl.querySelector can no longer see it — track it explicitly so
       it can always be restored when the strip must unmount. */
    let movedOrbit: HTMLElement | null = null;

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
      if (rootEl !== document.querySelector(".zh-page .hero-artwork")) return;
      const search = document.querySelector<HTMLElement>(".zh-page .zh-hero-search");
      const orbit =
        movedOrbit || rootEl.querySelector<HTMLElement>(".hero-artwork__orbit");
      if (!orbit || !search) return;

      if (!orbitParent) {
        orbitParent = orbit.parentElement;
        nextSibling = orbit.nextSibling;
      }

      if (!mq.matches) {
        restore(orbit);
        movedOrbit = null;
        return;
      }

      if (orbit.previousElementSibling !== search) {
        search.insertAdjacentElement("afterend", orbit);
      }
      movedOrbit = orbit;
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
    let ro: ResizeObserver | null = null;
    const attach = () => {
      if (ro) return;
      const searchEl = document.querySelector(".zh-page .zh-hero-search");
      if (!searchEl) return;
      ro = new ResizeObserver(sync);
      ro.observe(searchEl);
    };
    attach();

    /* The search bar may not be in the DOM yet while the artwork streams —
       pump until it is (cold loads can take a while), then stop. */
    let intervalId: ReturnType<typeof setTimeout> | null = null;
    let tries = 0;
    const pump = () => {
      const searchEl = document.querySelector(".zh-page .zh-hero-search");
      if (!searchEl) {
        tries += 1;
        if (tries <= 80) {
          intervalId = setTimeout(pump, 250);
        }
        return;
      }
      attach();
      sync();
    };
    intervalId = setTimeout(pump, 250);

    return () => {
      if (intervalId) clearTimeout(intervalId);
      mq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
      ro?.disconnect();
      if (movedOrbit) {
        restore(movedOrbit);
      } else {
        const orbit = rootEl.querySelector<HTMLElement>(".hero-artwork__orbit");
        if (orbit) restore(orbit);
      }
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
