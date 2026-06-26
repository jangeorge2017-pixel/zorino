import { Bot, TrendingUp, Tag, Globe } from "lucide-react";
import { marketingFeatures } from "@/lib/constants/features";

const featureIcons = {
  "AI Recommendations": Bot,
  "Real-time Price Tracking": TrendingUp,
  "Verified Coupons": Tag,
  "Global Coverage": Globe,
} as const;

/** Four fixed homepage feature cards — order and count must not change. */
export default function FeaturesSection() {
  return (
    <section className="features-section">
      <div className="features-grid">
        {marketingFeatures.map((feature) => {
          const Icon = featureIcons[feature.title as keyof typeof featureIcons];
          return (
            <article
              key={feature.title}
              className={`feature-card feature-accent-${feature.accent}`}
            >
              <div className="feature-icon">
                {Icon ? <Icon size={22} aria-hidden="true" /> : null}
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
