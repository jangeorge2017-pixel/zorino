import { Package, Store, Tag, TrendingUp } from "lucide-react";
import { HomeHeroVisualStage } from "@/components/zorino-home/HomeHeroBackground";
import type { FloatingProductCard, HeroStatItem } from "@/lib/types/entities";

const STAT_ICONS = {
  stores: Store,
  products: Package,
  coupons: Tag,
  tracking: TrendingUp,
} as const;

const ORBIT_SLOT_MAP: Record<string, string> = {
  "orbit-top": "top",
  "orbit-upper-left": "upper-left",
  "orbit-upper-right": "upper-right",
  "orbit-lower-left": "lower-left",
  "orbit-lower-right": "lower-right",
};

const VISIBLE_ORBIT_SLOTS = new Set(["top", "upper-left", "upper-right", "lower-left"]);

type ZorinoHomeHeroProps = {
  stats: HeroStatItem[];
  floatingProducts: FloatingProductCard[];
};

export default function ZorinoHomeHero({ stats, floatingProducts }: ZorinoHomeHeroProps) {
  const orbitCards = floatingProducts
    .map((card) => ({
      ...card,
      slot: ORBIT_SLOT_MAP[card.position] ?? card.position,
    }))
    .filter((card) => VISIBLE_ORBIT_SLOTS.has(card.slot));

  return (
    <div className="zh-hero">
      <div className="zh-hero__copy">
        <div className="zh-hero__badge">
          <span aria-hidden>✨</span> Powered by AI
        </div>
        <h1 className="zh-hero__title">
          Find Better
          <br />
          <span>Deals Faster</span>
        </h1>
        <p className="zh-hero__subtitle">
          Compare prices across thousands of stores, discover exclusive deals and save
          more on everything you love.
        </p>
        <div className="zh-hero__stats">
          {stats.map((stat) => {
            const Icon = STAT_ICONS[stat.key];
            return (
              <article key={stat.key} className={`zh-stat zh-stat--${stat.tone}`}>
                <div className="zh-stat__icon">
                  <Icon size={16} aria-hidden />
                </div>
                <p className="zh-stat__value">{stat.value}</p>
                <p className="zh-stat__label">{stat.label}</p>
              </article>
            );
          })}
        </div>
      </div>

      <HomeHeroVisualStage>
        <div className="zh-hero__orbit">
          {orbitCards.map((card) => (
            <div key={card.slot} className="zh-orbit-card" data-slot={card.slot}>
              <div className="zh-orbit-card__media">
                {card.discount ? (
                  <span className="zh-orbit-card__discount">{card.discount}</span>
                ) : null}
                <img src={card.imageSrc} alt="" />
              </div>
              {(card.price || card.original) && (
                <div className="zh-orbit-card__prices">
                  {card.price ? (
                    <span className="zh-orbit-card__price">{card.price}</span>
                  ) : null}
                  {card.original ? (
                    <span className="zh-orbit-card__was">{card.original}</span>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      </HomeHeroVisualStage>
    </div>
  );
}
