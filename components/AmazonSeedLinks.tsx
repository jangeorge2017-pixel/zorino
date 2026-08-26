"use client";

import { ExternalLink } from "lucide-react";
import { AMAZON_US_SEED_LINKS } from "@/lib/amazon/seed-links";

/**
 * Temporary seed-link catalog for Amazon US.
 * Renders 20 "Buy on Amazon" buttons — each opens its exact affiliate URL.
 * No product data is fabricated. Replace with Creators API live data later.
 */
export default function AmazonSeedLinks() {
  if (AMAZON_US_SEED_LINKS.length === 0) return null;

  return (
    <section className="amazon-seed-links" aria-label="Amazon US Deals">
      <h2 className="amazon-seed-links__title">Amazon US Deals</h2>
      <p className="amazon-seed-links__subtitle">
        Browse our curated Amazon picks — direct links with verified deals.
      </p>
      <div className="amazon-seed-links__grid">
        {AMAZON_US_SEED_LINKS.map((link) => (
          <a
            key={link.id}
            href={`/api/affiliate/go?to=${encodeURIComponent(link.affiliateUrl)}&store=amazon&source=seed-links`}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="amazon-seed-links__btn"
          >
            Buy on Amazon
            <ExternalLink size={14} aria-hidden />
          </a>
        ))}
      </div>
    </section>
  );
}
