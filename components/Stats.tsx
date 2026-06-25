import { Store, Package, Tag, TrendingUp } from "lucide-react";
import type { HeroStatItem } from "@/lib/types/entities";

type StatsProps = {
  stats: HeroStatItem[];
};

const iconMap = {
  stores: Store,
  products: Package,
  coupons: Tag,
  tracking: TrendingUp,
} as const;

export default function Stats({ stats }: StatsProps) {
  return (
    <div className="stats">
      {stats.map((stat) => {
        const Icon = iconMap[stat.key];
        return (
          <div key={stat.label} className={`stat-card stat-tone-${stat.tone}`}>
            <div className="stat-icon-wrap">
              <Icon size={16} className="stat-icon" />
            </div>
            <h3>{stat.value}</h3>
            <p>{stat.label}</p>
          </div>
        );
      })}
    </div>
  );
}
