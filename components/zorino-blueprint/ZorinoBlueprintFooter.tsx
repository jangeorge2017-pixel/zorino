"use client";

import { useState } from "react";
import { Store, Package, Tag, Users, Star } from "lucide-react";
import { TRUSTPILOT_LOGO } from "@/lib/assets";
import type { FooterStatItem } from "@/lib/types/entities";

const ICONS = {
  stores: Store,
  products: Package,
  coupons: Tag,
  users: Users,
} as const;

type Props = {
  stats: FooterStatItem[];
};

export default function ZorinoBlueprintFooter({ stats }: Props) {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <footer className="zb-footer">
      <div className="zb-footer-stats">
        {stats.map((stat) => {
          const Icon = ICONS[stat.key];
          return (
            <div key={stat.key} className="zb-footer-stat">
              <Icon size={16} aria-hidden />
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          );
        })}
      </div>

      <div className="zb-trustpilot">
        <strong>Excellent</strong>
        <span className="zb-trustpilot-stars" aria-label="5 out of 5 stars">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={16} fill="#22c55e" color="#22c55e" />
          ))}
        </span>
        <span>4.8 out of 5 based on 12,340 reviews on</span>
        {logoFailed ? (
          <strong>Trustpilot</strong>
        ) : (
          <img
            src={TRUSTPILOT_LOGO}
            alt="Trustpilot"
            width={88}
            height={22}
            onError={() => setLogoFailed(true)}
          />
        )}
      </div>
    </footer>
  );
}
