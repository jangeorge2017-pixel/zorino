"use client";

import { useState, type FormEvent } from "react";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Mail, Package, Send, Star, Store, Tag, Users } from "lucide-react";
import { TRUSTPILOT_LOGO } from "@/lib/assets";
import { useNewsletter } from "@/lib/features/newsletter-system";
import { ZH_FEATURED_COUPON_BRANDS } from "@/lib/zorino-home/featured-coupon-brands";
import type { FooterStatItem } from "@/lib/types/entities";
import type { Locale } from "@/i18n/config";
import "./ZorinoHomeFooter.css";

const ICONS = {
  stores: Store,
  products: Package,
  coupons: Tag,
  users: Users,
} as const;

/** Featured Stores only — official logos from existing project assets. */
const FEATURED_STORE_LOGOS: Record<string, string> = {
  amazon: "/stores/amazon.svg",
  aliexpress: "/stores/aliexpress.svg",
  noon: "/stores/noon.svg",
  ebay: "/stores/ebay.svg",
  temu: "/stores/temu.svg",
  shein: "/stores/shein.svg",
  nike: "/stores/nike.svg",
  adidas: "/stores/adidas.svg",
};

type ZorinoHomeFooterProps = {
  footerStats: FooterStatItem[];
};

export default function ZorinoHomeFooter({ footerStats }: ZorinoHomeFooterProps) {
  const t = useTranslations("home");
  const tHero = useTranslations("hero");
  const locale = useLocale() as Locale;
  const [logoFailed, setLogoFailed] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const { loading, subscribe } = useNewsletter();

  const statLabel = (key: FooterStatItem["key"], fallback: string) => {
    switch (key) {
      case "stores":
        return tHero("statStores");
      case "products":
        return tHero("statProducts");
      case "coupons":
        return tHero("statCoupons");
      case "users":
        return t("statHappyUsers");
      default:
        return fallback;
    }
  };

  const handleNewsletter = async (event: FormEvent) => {
    event.preventDefault();
    const value = email.trim();
    if (!value) return;
    try {
      await subscribe(value, undefined, locale);
      setMessage(t("newsletterSuccess"));
      setEmail("");
    } catch {
      setMessage(t("newsletterThanks"));
    }
  };

  return (
    <footer className="zh-footer" id="zh-section-stores">
      <div className="zh-footer__featured-stores">
        <div className="zh-footer__featured-head">
          <h2 className="zh-footer__featured-title">{t("featuredStores")}</h2>
          <Link href="/stores" className="zh-footer__featured-link">
            {t("viewAllStores")}
          </Link>
        </div>
        <div className="zh-footer__store-logos">
          {ZH_FEATURED_COUPON_BRANDS.slice(0, 8).map((brand) => {
            const logoSrc = FEATURED_STORE_LOGOS[brand.id] ?? brand.logoSrc;
            return (
              <Link
                key={brand.id}
                href={`/stores/${brand.slug}`}
                className="zh-footer__store-logo"
                title={brand.name}
              >
                {logoSrc ? (
                  <img src={logoSrc} alt={brand.name} loading="lazy" decoding="async" />
                ) : (
                  <span>{brand.logoInitial}</span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="zh-footer__newsletter">
        <div className="zh-footer__newsletter-copy">
          <h2 className="zh-footer__newsletter-title">
            <Mail size={18} aria-hidden />
            {t("newsletterTitle")}
          </h2>
          <p className="zh-footer__newsletter-text">{t("newsletterText")}</p>
        </div>
        <form className="zh-footer__newsletter-form" onSubmit={handleNewsletter}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("newsletterPlaceholder")}
            aria-label={t("newsletterPlaceholder")}
            required
          />
          <button type="submit" className="zh-footer__newsletter-submit" disabled={loading}>
            <Send size={16} aria-hidden />
            {loading ? t("newsletterSubscribing") : t("newsletterSubscribe")}
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
                <span>{statLabel(stat.key, stat.label)}</span>
              </div>
            );
          })}
        </div>

        <div className="zh-footer__trustpilot">
          <strong>{t("trustExcellent")}</strong>
          <span className="zh-footer__stars" aria-label={t("outOfStars", { rating: 5 })}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={16} fill="#22c55e" color="#22c55e" />
            ))}
          </span>
          <span>{t("trustReviews")}</span>
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
