"use client";

import { useState } from "react";

import { FloatingProductCard } from "@/lib/types/entities";

interface HeroCardPosition {
  position: "orbit-top" | "orbit-upper-left" | "orbit-upper-right" | "orbit-lower-right";
  key: string;
  isVisible: boolean;
}

function getCardPosition(position: "orbit-top" | "orbit-upper-left" | "orbit-upper-right" | "orbit-lower-right"): HeroCardPosition {
  return {
    position,
    key: `hero-card-${position}-${Math.random().toString(36).substring(2, 9)}`,
    isVisible: true,
  };
}

export function useHeroCardPositions() {
  const positions: HeroCardPosition[] = [
    getCardPosition("orbit-top"),
    getCardPosition("orbit-upper-left"),
    getCardPosition("orbit-upper-right"),
    getCardPosition("orbit-lower-right"),
  ];

  return positions;
}

export function useHeroCardVisibility(initialVisibility: boolean = false) {
  const [isVisible, setIsVisible] = useState(initialVisibility);

  const toggle = () => setIsVisible((prev) => !prev);

  return { isVisible, toggle };
}

export function useHeroCardAnimation() {
  const [isAnimating, setIsAnimating] = useState(false);

  const startAnimation = () => setIsAnimating(true);
  const stopAnimation = () => setIsAnimating(false);

  return { isAnimating, startAnimation, stopAnimation };
}
