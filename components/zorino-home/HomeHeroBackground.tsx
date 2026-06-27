import { HERO_BACKGROUND } from "@/lib/background";
import "./home-hero-background.css";

type HomeHeroBackgroundProps = {
  children: React.ReactNode;
  className?: string;
  label?: string;
};

/**
 * Homepage-only backdrop: nebula, star field, and ambient glow.
 * Content (hero, search, categories, commerce) renders on top via children.
 */
export default function HomeHeroBackground({
  children,
  className,
  label = "Hero",
}: HomeHeroBackgroundProps) {
  return (
    <section className={className ? `hhb ${className}` : "hhb"} aria-label={label}>
      <div className="hhb__backdrop" aria-hidden="true">
        <div className="hhb__nebula" />
        <div className="hhb__stars" />
        <div className="hhb__ambient-glow" />
      </div>
      <div className="hhb__content">{children}</div>
    </section>
  );
}

type HomeHeroVisualStageProps = {
  children: React.ReactNode;
  label?: string;
};

/**
 * Homepage-only Z lightning pedestal + glow. Orbit product cards render as children.
 * Keeps visual effects aligned on all breakpoints (paired with HomeHeroBackground).
 */
export function HomeHeroVisualStage({
  children,
  label = "Featured products",
}: HomeHeroVisualStageProps) {
  return (
    <div className="hhv-stage" aria-label={label}>
      <div className="hhv-stage__lightning" aria-hidden="true">
        <div
          className="hhv-stage__image"
          style={{ backgroundImage: `url("${HERO_BACKGROUND}")` }}
        />
        <div className="hhv-stage__glow" />
      </div>
      <div className="hhv-stage__foreground">{children}</div>
    </div>
  );
}
