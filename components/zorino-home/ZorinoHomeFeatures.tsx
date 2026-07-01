import { ZH_FEATURES } from "@/lib/zorino-home/content";

export default function ZorinoHomeFeatures() {
  return (
    <section className="zh-features" id="zh-section-features" aria-label="Platform features">
      {ZH_FEATURES.map((feature) => (
        <article key={feature.title} className={`zh-feature zh-feature--${feature.accent}`}>
          <div className="zh-feature__icon">
            <img src={feature.icon} alt="" width={22} height={22} />
          </div>
          <h3>{feature.title}</h3>
          <p>{feature.text}</p>
        </article>
      ))}
    </section>
  );
}
