"use client";

import { ExternalLink } from "lucide-react";
import { AMAZON_EG_SEED_LINKS } from "@/lib/amazon-eg/seed-links";

/**
 * Amazon Egypt seed-link catalog.
 * Renders "Buy on Amazon Egypt" buttons — each links to a real amazon.eg product.
 * No product data is fabricated.
 */
export default function AmazonEgSeedLinks() {
  if (AMAZON_EG_SEED_LINKS.length === 0) return null;

  return (
    <section className="amazon-seed-links" aria-label="Amazon Egypt Deals">
      <h2 className="amazon-seed-links__title">Amazon Egypt Deals</h2>
      <p className="amazon-seed-links__subtitle">
        Browse our curated Amazon Egypt picks — direct links with verified deals.
      </p>
      <div className="amazon-seed-links__grid">
        {AMAZON_EG_SEED_LINKS.map((link) => (
          <a
            key={link.id}
            href={`/api/affiliate/go?to=${encodeURIComponent(link.affiliateUrl)}&store=amazon-eg&source=seed-links`}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="amazon-seed-links__btn"
          >
            Buy on Amazon Egypt
            <ExternalLink size={14} aria-hidden />
          </a>
        ))}
      </div>
    </section>
  );
}
