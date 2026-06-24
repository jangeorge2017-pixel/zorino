"use client";

import Image from "next/image";
import { useState } from "react";
import { Store, Package, Tag, Users, Star } from "lucide-react";
import { TRUSTPILOT_LOGO } from "@/lib/assets";

const footerStats = [
  { icon: Store, value: "50+", label: "Stores" },
  { icon: Package, value: "10M+", label: "Products" },
  { icon: Tag, value: "100K+", label: "Coupons" },
  { icon: Users, value: "5M+", label: "Happy Users" },
];

export default function FooterStats() {
  const [trustpilotFailed, setTrustpilotFailed] = useState(false);

  return (
    <section className="footer-stats">
      <div className="footer-stats-left">
        {footerStats.map((stat) => (
          <div key={stat.label} className="footer-stat-item">
            <stat.icon size={16} />
            <span className="footer-stat-value">{stat.value}</span>
            <span className="footer-stat-label">{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="footer-trustpilot">
        <span className="trustpilot-label">Excellent</span>
        <div className="trustpilot-stars">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={16} fill="#22c55e" color="#22c55e" />
          ))}
        </div>
        <span className="trustpilot-rating">4.8</span>
        <span className="trustpilot-reviews">
          out of 5 based on 12,340 reviews on
        </span>
        {trustpilotFailed ? (
          <span className="trustpilot-logo-fallback">Trustpilot</span>
        ) : (
          <Image
            src={TRUSTPILOT_LOGO}
            alt="Trustpilot"
            width={88}
            height={22}
            className="trustpilot-logo"
            onError={() => setTrustpilotFailed(true)}
          />
        )}
      </div>
    </section>
  );
}
