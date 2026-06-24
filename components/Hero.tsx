import Stats from "@/components/Stats";
import AssetImage from "@/components/AssetImage";
import { floatingProducts } from "@/data/home";

export default function Hero() {
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

        <Stats />
      </div>

      <div className="hero-visual">
        {floatingProducts.map((product) => (
          <div key={product.position} className={`floating-card ${product.position}`}>
            <span className="floating-discount">{product.discount}</span>
            <div className="floating-product-image">
              <AssetImage
                src={product.imageSrc}
                alt=""
                width={400}
                height={400}
                className="floating-product-img"
                fallback={<span className="floating-emoji">{product.emoji}</span>}
              />
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
