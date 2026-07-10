import { getTranslations } from "next-intl/server";
import { ZH_FEATURES } from "@/lib/zorino-home/content";

const FEATURE_KEYS = [
  { title: "featureAiTitle", text: "featureAiText" },
  { title: "featureTrackingTitle", text: "featureTrackingText" },
  { title: "featureCouponsTitle", text: "featureCouponsText" },
  { title: "featureGlobalTitle", text: "featureGlobalText" },
] as const;

export default async function ZorinoHomeFeatures() {
  const t = await getTranslations("home");

  return (
    <section
      className="zh-features"
      id="zh-section-features"
      aria-label={t("platformFeatures")}
    >
      {ZH_FEATURES.map((feature, index) => {
        const keys = FEATURE_KEYS[index];
        return (
          <article
            key={feature.icon}
            className={`zh-feature zh-feature--${feature.accent}`}
          >
            <div className="zh-feature__icon">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={feature.icon} alt="" width={22} height={22} />
            </div>
            <h3>{t(keys.title)}</h3>
            <p>{t(keys.text)}</p>
          </article>
        );
      })}
    </section>
  );
}
