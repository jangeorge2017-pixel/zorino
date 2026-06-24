import { Store, Package, Tag, TrendingUp } from "lucide-react";

const heroStats = [
  { icon: Store, value: "50+", label: "Stores", tone: "purple" },
  { icon: Package, value: "10M+", label: "Products", tone: "blue" },
  { icon: Tag, value: "100K+", label: "Coupons", tone: "green" },
  { icon: TrendingUp, value: "Real-time", label: "Price Tracking", tone: "violet" },
];
export default function Stats() {
  return (
    <div className="stats">
      {heroStats.map((stat) => (
        <div key={stat.label} className={`stat-card stat-tone-${stat.tone}`}>
          <div className="stat-icon-wrap">
            <stat.icon size={16} className="stat-icon" />
          </div>
          <h3>{stat.value}</h3>
          <p>{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
