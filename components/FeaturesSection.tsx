import { Bot, TrendingUp, Tag, Globe } from "lucide-react";
import { marketingFeatures } from "@/lib/constants/features";
import AssetImage from "@/components/AssetImage";

const featureIconFallback = {
  "AI Recommendations": Bot,
  "Real-time Price Tracking": TrendingUp,
  "Verified Coupons": Tag,
  "Global Coverage": Globe,
} as const;

export default function FeaturesSection() {
  return (
    <section className="features-section">
      <div className="features-grid">
        {marketingFeatures.map((feature) => {
          const FallbackIcon = featureIconFallback[feature.title as keyof typeof featureIconFallback];
          return (
            <article
              key={feature.title}
              className={`feature-card feature-accent-${feature.accent}`}
            >
              <div className="feature-icon">
                <AssetImage
                  src={feature.iconSrc}
                  alt=""
                  width={22}
                  height={22}
                  className="feature-icon-img"
                  fallback={FallbackIcon ? <FallbackIcon size={22} /> : null}
                />
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
