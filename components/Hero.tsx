import Stats from "@/components/Stats";
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
        {floatingProducts.map((product) => (
          <div key={product.position} className={`floating-card ${product.position}`}>
            <span className="floating-discount">{product.discount}</span>
            <div className="floating-product-image">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={product.imageSrc} alt="" className="floating-product-img" />
            </div>
            <div className="floating-prices">
              <span className="floating-price">{product.price}</span>
              <span className="floating-original">{product.original}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
