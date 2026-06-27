const FEATURES = [
  {
    icon: "/icons/feature-ai.svg",
    title: "AI Recommendations",
    text: "Smart AI suggests the best products and deals for you.",
    accent: "purple",
  },
  {
    icon: "/icons/feature-tracking.svg",
    title: "Real-time Price Tracking",
    text: "We track price changes 24/7 so you never overpay.",
    accent: "pink",
  },
  {
    icon: "/icons/feature-coupons.svg",
    title: "Verified Coupons",
    text: "Thousands of verified coupons updated daily.",
    accent: "green",
  },
  {
    icon: "/icons/feature-globe.svg",
    title: "Global Coverage",
    text: "Compare prices from 50+ countries and global stores.",
    accent: "blue",
  },
] as const;

export default function ZorinoBlueprintFeatures() {
  return (
    <section className="zb-features" aria-label="Platform features">
      {FEATURES.map((feature) => (
        <article
          key={feature.title}
          className={`zb-feature zb-feature--${feature.accent}`}
        >
          <div className="zb-feature-icon">
            <img src={feature.icon} alt="" width={22} height={22} />
          </div>
          <h3>{feature.title}</h3>
          <p>{feature.text}</p>
        </article>
      ))}
    </section>
  );
}
