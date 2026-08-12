"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
// import { useMediaQuery } from "@/hooks/use-media-query";
import { FloatingProductCard } from "@/lib/types/entities";
import { getHeroFloatingProducts } from "@/lib/data/homepage";

interface MobileHeroCardsContextType {
  floatingCards: FloatingProductCard[];
  isLoading: boolean;
  error: string | null;
}

const MobileHeroCardsContext = createContext<MobileHeroCardsContextType | undefined>(undefined);

interface MobileHeroCardsProviderProps {
  children: ReactNode;
}

export function MobileHeroCardsProvider({ children }: MobileHeroCardsProviderProps) {
  const [floatingCards, setFloatingCards] = useState<FloatingProductCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCards() {
      try {
        const cards = await getHeroFloatingProducts();
        setFloatingCards(cards);
      } catch (err) {
        console.error("Failed to load floating cards:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    }

    loadCards();
  }, []);

  return (
    <MobileHeroCardsContext.Provider value={{ floatingCards, isLoading, error }}>
      {children}
    </MobileHeroCardsContext.Provider>
  );
}

export function useMobileHeroCards() {
  const context = useContext(MobileHeroCardsContext);
  if (context === undefined) {
    throw new Error("useMobileHeroCards must be used within a MobileHeroCardsProvider");
  }
  return context;
}
