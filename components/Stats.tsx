import { Store, Package, Tag, Clock } from "lucide-react";

const heroStats = [
  { icon: Store, value: "50+", label: "Stores" },
  { icon: Package, value: "10M+", label: "Products" },
  { icon: Tag, value: "100K+", label: "Coupons" },
  { icon: Clock, value: "Real-time", label: "Price Tracking" },
];

export default function Stats() {
  return (
    <div className="stats">
      {heroStats.map((stat) => (
        <div key={stat.label} className="stat-card">
          <stat.icon size={18} className="stat-icon" />
          <h3>{stat.value}</h3>
          <p>{stat.label}</p>
        </div>
      ))}
    </div>
  );
}