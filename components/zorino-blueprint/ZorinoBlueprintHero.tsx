import { Store, Package, Tag, TrendingUp } from "lucide-react";
import type { FloatingProductCard, HeroStatItem } from "@/lib/types/entities";

const STAT_ICONS = {
  stores: Store,
  products: Package,
  coupons: Tag,
  tracking: TrendingUp,
} as const;

const ORBIT_SLOTS = ["top", "upper-left", "upper-right", "lower-left"] as const;

const POSITION_MAP: Record<string, (typeof ORBIT_SLOTS)[number]> = {
  "orbit-top": "top",
  "orbit-upper-left": "upper-left",
  "orbit-upper-right": "upper-right",
  "orbit-lower-left": "lower-left",
};

type Props = {
  stats: HeroStatItem[];
  floating: FloatingProductCard[];
};

export default function ZorinoBlueprintHero({ stats, floating }: Props) {
  const orbitCards = floating.slice(0, 4);

  return (
    <section className="zb-hero" aria-label="Hero">
      <div className="zb-hero-copy">
        <div className="zb-hero-badge">
          <span aria-hidden>✨</span> Powered by AI
        </div>
        <h1 className="zb-hero-title">
          Find Better
          <br />
          <em>Deals Faster</em>
        </h1>
        <p className="zb-hero-sub">
          Compare prices across thousands of stores, discover exclusive deals and save
          more on everything you love.
        </p>
        <div className="zb-hero-stats">
          {stats.map((stat) => {
            const Icon = STAT_ICONS[stat.key];
            return (
              <article key={stat.key} className={`zb-stat zb-stat--${stat.tone}`}>
                <div className="zb-stat-icon">
                  <Icon size={16} aria-hidden />
                </div>
                <p className="zb-stat-value">{stat.value}</p>
                <p className="zb-stat-label">{stat.label}</p>
              </article>
            );
          })}
        </div>
      </div>

      <div className="zb-hero-stage" aria-hidden>
        <div className="zb-hero-z" />
        <div className="zb-hero-glow" />
        <div className="zb-orbit">
          {orbitCards.map((card) => {
            const slot = POSITION_MAP[card.position] ?? "top";
            return (
              <div key={card.position} className="zb-orbit-card" data-slot={slot}>
                <div className="zb-orbit-media">
                  {card.discount ? (
                    <span className="zb-orbit-discount">{card.discount}</span>
                  ) : null}
                  <img src={card.imageSrc} alt="" />
                </div>
                <div className="zb-orbit-prices">
                  <span className="zb-orbit-price">{card.price}</span>
                  {card.original ? (
                    <span className="zb-orbit-was">{card.original}</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
