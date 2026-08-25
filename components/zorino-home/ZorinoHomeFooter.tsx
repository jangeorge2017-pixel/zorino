"use client";

import { useState, type FormEvent } from "react";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Mail, Package, Send, Store, Tag, Users } from "lucide-react";
import { useNewsletter } from "@/lib/features/newsletter-system";
import type { FooterStatItem } from "@/lib/types/entities";
import type { Locale } from "@/i18n/config";
import "./ZorinoHomeFooter.css";

const ICONS = {
  stores: Store,
  products: Package,
  coupons: Tag,
  users: Users,
} as const;

/** Featured Stores strip — slugs that exist in the live stores table. */
const FEATURED_STORES = [
  { id: "amazon", slug: "amazon", name: "Amazon", logoSrc: "/stores/amazon.svg", initial: "a" },
  { id: "aliexpress", slug: "aliexpress", name: "AliExpress", logoSrc: "/stores/aliexpress.svg", initial: "AE" },
  { id: "noon", slug: "noon", name: "Noon", logoSrc: "/stores/noon.svg", initial: "N" },
  { id: "ebay", slug: "ebay", name: "eBay", logoSrc: "/stores/ebay.svg", initial: "e" },
  { id: "nike", slug: "nike", name: "Nike", logoSrc: "/stores/nike.svg", initial: "N" },
  { id: "walmart", slug: "walmart", name: "Walmart", logoSrc: "/stores/walmart.svg", initial: "W" },
  { id: "cjdropshipping", slug: "cjdropshipping", name: "CJdropshipping", logoSrc: "/stores/cjdropshipping.svg", initial: "CJ" },
] as const;

type ZorinoHomeFooterProps = {
  footerStats: FooterStatItem[];
};

export default function ZorinoHomeFooter({ footerStats }: ZorinoHomeFooterProps) {
  const t = useTranslations("home");
  const tHero = useTranslations("hero");
  const tFooter = useTranslations("footer");
  const locale = useLocale() as Locale;
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
          {FEATURED_STORES.map((store) => (
            <Link
              key={store.id}
              href={`/stores/${store.slug}`}
              className="zh-footer__store-logo"
              title={store.name}
            >
              <img
                src={store.logoSrc}
                alt={store.name}
                loading="lazy"
                decoding="async"
              />
            </Link>
          ))}
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

        <p className="zh-footer__disclosure">
          {t("affiliateDisclosure")}{" "}
          <Link href="/affiliate-disclosure">{t("affiliateDisclosureMore")}</Link>
        </p>
      </div>

      <nav className="zh-footer__legal-links" aria-label={tFooter("legal")}>
        {[
          { key: "imprint", href: "/imprint" },
          { key: "about", href: "/about" },
          { key: "privacy", href: "/privacy" },
          { key: "terms", href: "/terms" },
          { key: "cookies", href: "/cookies" },
          { key: "affiliate", href: "/affiliate-disclosure" },
          { key: "contact", href: "/contact" },
        ].map(({ key, href }) => (
          <Link key={key} href={href}>
            {tFooter(key as "imprint" | "about" | "privacy" | "terms" | "cookies" | "affiliate" | "contact")}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
