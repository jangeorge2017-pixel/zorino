import { Sparkles, TrendingUp, ShieldCheck, Globe } from "lucide-react";
import { features } from "@/data/home";

const iconMap = {
  sparkles: Sparkles,
  trending: TrendingUp,
  shield: ShieldCheck,
  globe: Globe,
} as const;

export default function FeaturesSection() {
  return (
    <section className="features-section">
      <div className="features-grid">
        {features.map((feature) => {
          const Icon = iconMap[feature.icon as keyof typeof iconMap];
          return (
            <article key={feature.title} className="feature-card">
              <div className="feature-icon">
                <Icon size={22} />
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
