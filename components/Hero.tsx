import Image from "next/image";
import Stats from "@/components/Stats";

const floatingProducts = [
  { emoji: "🎧", discount: "-25%", price: "$79", original: "$99", position: "card-1" },
  { emoji: "💻", discount: "-18%", price: "$899", original: "$1099", position: "card-2" },
  { emoji: "📱", discount: "-12%", price: "$899", original: "$1029", position: "card-3" },
  { emoji: "🎮", discount: "-20%", price: "$399", original: "$499", position: "card-4" },
];

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
            <span className="floating-emoji">{product.emoji}</span>
            <div className="floating-prices">
              <span className="floating-price">{product.price}</span>
              <span className="floating-original">{product.original}</span>
            </div>
          </div>
        ))}

        <div className="hero-platform">
          <div className="platform-ring platform-ring-outer" />
          <div className="platform-ring platform-ring-inner" />
          <div className="platform-glow" />
          <Image
            src="/hero-z.png"
            alt="Zorino neon Z logo"
            width={380}
            height={380}
            className="hero-z-image"
            priority
          />
        </div>
      </div>
    </section>
  );
}
