import AssetImage from "@/components/AssetImage";
import { marketingFeatures } from "@/lib/constants/features";

/** Four fixed homepage feature cards — order and count must not change. */
export default function FeaturesSection() {
  return (
    <section className="features-section">
      <div className="features-grid">
        {marketingFeatures.map((feature) => (
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
              />
            </div>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
