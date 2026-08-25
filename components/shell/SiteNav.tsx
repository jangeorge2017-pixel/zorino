"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import {
  Bell,
  Heart,
  Menu,
  Search,
  User,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import IntlNavSelectors from "@/components/international/IntlNavSelectors";
import SiteNavMenu from "@/components/shell/SiteNavMenu";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { useAuth } from "@/lib/auth/auth-context";
import { ZORINO_LOGO_SOURCE } from "@/lib/assets";
import { SITE_NAV_MENUS } from "@/lib/navigation/site-menu";
import "./site-nav.css";

/**
 * Public site chrome. Mobile layout matches homepage nav (flex cluster).
 * Desktop/tablet keep existing design-system flex rhythm.
 *
 * Below 1280px the inline nav links are hidden by design-system.css — the
 * hamburger menu here is the only navigation alternative, so it must stay.
 */
export default function SiteNav() {
  const t = useTranslations("common");
  const tHero = useTranslations("hero");
  const { user } = useAuth();
  const accountHref = user ? "/profile" : "/auth/login";
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="zor-nav" data-sticky-chrome="primary">
      <div className="zor-nav__inner">
        <Link href="/" className="zor-nav__logo">
          <img src={ZORINO_LOGO_SOURCE} alt="ZORINO" width={118} height={40} />
          <span className="zor-nav__tagline">{tHero("title")}</span>
        </Link>

        <nav className="zor-nav__links" aria-label={t("primaryNav")}>
          <SiteNavMenu />
        </nav>

        <button
          type="button"
          className="zor-nav__icon-btn zor-nav__menu-btn"
          aria-label={menuOpen ? t("close") : t("menu")}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
        </button>

        <div className="zor-nav__actions">
          <Link
            href="/search"
            className="zor-nav__icon-btn zor-nav__icon-btn--search"
            aria-label={t("search")}
          >
            <Search size={20} strokeWidth={2} />
          </Link>
          <span className="zor-nav__control zor-nav__control--theme">
            <ThemeSwitcher />
          </span>
          <span className="zor-nav__control zor-nav__control--intl">
            <IntlNavSelectors />
          </span>
          <Link
            href="/wishlist"
            className="zor-nav__icon-btn zor-nav__icon-btn--wishlist"
            aria-label={t("wishlist")}
          >
            <Heart size={20} strokeWidth={2} aria-hidden />
            <span>{t("wishlist")}</span>
          </Link>
          <Link
            href="/notifications"
            className="zor-nav__icon-btn zor-nav__icon-btn--notify"
            aria-label={t("notifications")}
          >
            <Bell size={20} strokeWidth={2} aria-hidden />
          </Link>
          <Link
            href={accountHref}
            className="zor-nav__profile"
            aria-label={user ? t("profile") : t("signIn")}
          >
            <span className="zor-nav__avatar-ring" aria-hidden />
            {user?.avatar ? (
              <img src={user.avatar} alt="" width={32} height={32} />
            ) : (
              <span className="zor-nav__profile-fallback" aria-hidden>
                <User size={18} />
              </span>
            )}
            <div>
              <strong>
                {t("hiUser", {
                  name: user ? user.name.split(" ")[0] || user.name : "User",
                })}
              </strong>
            </div>
          </Link>
        </div>
      </div>

      {menuOpen ? (
        <>
          <button
            type="button"
            className="zor-nav__menu-backdrop"
            aria-label={t("close")}
            onClick={() => setMenuOpen(false)}
          />
          <nav className="zor-nav__mobile-menu" aria-label={t("primaryNav")}>
            <ul>
              {SITE_NAV_MENUS.map((section) => (
                <li key={section.id}>
                  <Link href={section.href} onClick={() => setMenuOpen(false)}>
                    {section.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </>
      ) : null}
    </header>
  );
}
