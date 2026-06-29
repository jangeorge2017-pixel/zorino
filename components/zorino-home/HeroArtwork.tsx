import HeroFloatingCard from "@/components/zorino-home/HeroFloatingCard";
import { HERO_BACKGROUND } from "@/lib/background";
import type { FloatingProductCard } from "@/lib/types/entities";

type HeroArtworkProps = {
  floatingProducts: FloatingProductCard[];
};

export default function HeroArtwork({ floatingProducts }: HeroArtworkProps) {
  return (
    <div className="hero-artwork" aria-hidden="true">
      <div className="hero-artwork__backdrop">
        <div className="hero-artwork__atmosphere">
          <div className="hero-artwork__nebula" />
          <div className="hero-artwork__stars" />
          <div className="hero-artwork__glow" />
        </div>
      </div>

      <div className="hero-artwork__logo-stage">
        <img
          className="hero-artwork__lightning"
          src={HERO_BACKGROUND}
          alt=""
          aria-hidden
          decoding="async"
        />
        <img
          className="hero-artwork__lightning hero-artwork__lightning--enhance"
          src={HERO_BACKGROUND}
          alt=""
          aria-hidden
          decoding="async"
        />
        <div className="hero-artwork__logo-base-uplight" />
      </div>

      {floatingProducts.length > 0 ? (
        <div className="hero-artwork__orbit" aria-label="Featured products">
          {floatingProducts.map((product) => (
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
