import Stats from "@/components/Stats";
import HeroOrbitCard from "@/components/HeroOrbitCard";
import { getHeroOrbitAnimationDelay } from "@/lib/hero/orbit";
import type { FloatingProductCard, HeroStatItem } from "@/lib/types/entities";

type HeroProps = {
  floatingProducts: FloatingProductCard[];
  stats: HeroStatItem[];
};

export default function Hero({ floatingProducts, stats }: HeroProps) {
  return (
    <section className="hero-section">
      <div className="hero-content">
        <div className="badge">
          <span className="badge-icon">✨</span>
          Powered by AI
        </div>

        <h1 className="hero-title">
          Find Better
          <br />
          <span>Deals Faster</span>
        </h1>

        <p className="hero-text">
          Compare prices across thousands of stores, discover exclusive deals and save more on everything you love.
        </p>

        <Stats stats={stats} />
      </div>

      <div className="hero-visual">
        <div className="hero-visual-stage">
          <div className="hero-visual-z-bg" aria-hidden="true" />
          <div className="hero-visual-glow" aria-hidden="true" />
          <div className="hero-orbit" aria-label="Featured products">
            {floatingProducts.map((product) => (
              <HeroOrbitCard
                key={product.position}
                product={product}
                animationDelay={getHeroOrbitAnimationDelay(product.position)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
