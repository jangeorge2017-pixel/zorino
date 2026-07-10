"use client";

import { useState, type FormEvent } from "react";
import { Link } from "@/i18n/navigation";
import { Mail, Package, Send, Star, Store, Tag, Users } from "lucide-react";
import { TRUSTPILOT_LOGO } from "@/lib/assets";
import { useNewsletter } from "@/lib/features/newsletter-system";
import { ZH_FEATURED_COUPON_BRANDS } from "@/lib/zorino-home/featured-coupon-brands";
import type { FooterStatItem } from "@/lib/types/entities";

const ICONS = {
  stores: Store,
  products: Package,
  coupons: Tag,
  users: Users,
} as const;

type ZorinoHomeFooterProps = {
  footerStats: FooterStatItem[];
};

export default function ZorinoHomeFooter({ footerStats }: ZorinoHomeFooterProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const { loading, subscribe } = useNewsletter();

  const handleNewsletter = async (event: FormEvent) => {
    event.preventDefault();
    const value = email.trim();
    if (!value) return;
    try {
      await subscribe(value, undefined, "en");
      setMessage("You're subscribed! Watch your inbox for the best deals.");
      setEmail("");
    } catch {
      setMessage("Thanks! We'll keep you posted on new deals.");
    }
  };

  return (
    <footer className="zh-footer" id="zh-section-stores">
      <div className="zh-footer__featured-stores">
        <div className="zh-footer__featured-head">
          <h2 className="zh-footer__featured-title">Featured Stores</h2>
          <Link href="/stores" className="zh-footer__featured-link">
            View all stores →
          </Link>
        </div>
        <div className="zh-footer__store-logos">
          {ZH_FEATURED_COUPON_BRANDS.slice(0, 8).map((brand) => (
            <Link
              key={brand.id}
              href={`/stores/${brand.slug}`}
              className="zh-footer__store-logo"
              title={brand.name}
            >
              {brand.logoSrc ? (
                <img src={brand.logoSrc} alt={brand.name} loading="lazy" decoding="async" />
              ) : (
                <span>{brand.logoInitial}</span>
              )}
            </Link>
          ))}
        </div>
      </div>

      <div className="zh-footer__newsletter">
        <div className="zh-footer__newsletter-copy">
          <h2 className="zh-footer__newsletter-title">
            <Mail size={18} aria-hidden />
            Newsletter
          </h2>
          <p className="zh-footer__newsletter-text">
            Get weekly deal alerts, price drops, and exclusive coupon codes delivered to
            your inbox.
          </p>
        </div>
        <form className="zh-footer__newsletter-form" onSubmit={handleNewsletter}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            aria-label="Email address"
            required
          />
          <button type="submit" className="zh-footer__newsletter-submit" disabled={loading}>
            <Send size={16} aria-hidden />
            {loading ? "Subscribing…" : "Subscribe"}
          </button>
        </form>
        {message ? <p className="zh-footer__newsletter-msg">{message}</p> : null}
      </div>

      <div className="zh-footer__bottom">
        <div className="zh-footer__stats">
          {footerStats.map((stat) => {
            const Icon = ICONS[stat.key];
            return (
              <div key={stat.key} className="zh-footer__stat">
                <Icon size={16} aria-hidden />
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            );
          })}
        </div>

        <div className="zh-footer__trustpilot">
          <strong>Excellent</strong>
          <span className="zh-footer__stars" aria-label="5 out of 5 stars">
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
      </div>
    </footer>
  );
}
