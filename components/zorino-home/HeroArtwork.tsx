import HeroFloatingCard from "@/components/zorino-home/HeroFloatingCard";
import type { FloatingProductCard } from "@/lib/types/entities";
const HERO_ORBIT_COMPOSITION = [
  "orbit-top",
  "orbit-upper-left",
  "orbit-upper-right",
  "orbit-lower-right",
] as const;

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
