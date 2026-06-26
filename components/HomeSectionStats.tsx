import type { HomeSectionVariant } from "@/lib/homepage/sections";

export type HomeSectionStatItem = {
  label: string;
  value: string;
};

type HomeSectionStatsProps = {
  variant: HomeSectionVariant;
  items: HomeSectionStatItem[];
};

export default function HomeSectionStats({ variant, items }: HomeSectionStatsProps) {
  if (items.length === 0) return null;

  return (
    <ul className={`home-section-stats home-section-stats--${variant}`}>
      {items.map((item) => (
        <li key={`${item.label}-${item.value}`} className="home-section-stat">
          <span className="home-section-stat-value">{item.value}</span>
          <span className="home-section-stat-label">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
