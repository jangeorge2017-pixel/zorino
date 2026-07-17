"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  Crown,
  Heart,
  Search,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import IntlNavSelectors from "@/components/international/IntlNavSelectors";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { ZorinoLogo } from "@/components/ZorinoLogo";
import ZorinoHomeMobileMenu from "@/components/zorino-home/ZorinoHomeMobileMenu";
import ZorinoHomeNavLinks from "@/components/zorino-home/ZorinoHomeNavLinks";
import { useAuth } from "@/lib/auth/auth-context";
import "./nav.css";

export default function ZorinoHomeNav() {
  const t = useTranslations("common");
  const { user } = useAuth();
  const displayName = user
    ? user.name.split(" ")[0] || user.name
    : null;
  const accountHref = user ? "/profile" : "/auth/login";
  const accountLabel = user ? t("profile") : t("signIn");

  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      setIsMobile(mq.matches);
      if (!mq.matches) setMenuOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <header className="zh-nav" data-sticky-chrome="primary">
      <div className="zh-nav__inner">
        <Link href="/" className="zh-nav__logo">
          <ZorinoLogo className="zh-nav__logo-lockup" displayHeight={61.6} />
        </Link>

        <ZorinoHomeNavLinks />

        <div className="zh-nav__search-slot">
          <Link
            href="/search"
            className="zh-nav__icon-btn zh-nav__icon-btn--square"
            aria-label={t("search")}
          >
            <Search size={17} strokeWidth={2} />
          </Link>
        </div>

        <div className="zh-nav__actions">
          {/* Desktop/tablet only — mobile uses Avatar menu for Language + Theme */}
          <span className="zh-nav__desktop-intl">
            <IntlNavSelectors />
          </span>
          <span className="zh-nav__desktop-theme">
            <ThemeSwitcher />
          </span>
          <Link href="/wishlist" className="zh-nav__icon-btn zh-nav__wishlist">
            <Heart size={17} strokeWidth={2} aria-hidden />
            <span className="zh-nav__wishlist-label">{t("wishlist")}</span>
          </Link>
          <Link
            href="/notifications"
            className="zh-nav__icon-btn zh-nav__icon-btn--square"
            aria-label={t("notifications")}
          >
            <Bell size={17} strokeWidth={2} aria-hidden />
          </Link>

          {isMobile ? (
            <button
              type="button"
              className="zh-nav__profile zh-nav__profile--menu"
              aria-label={t("menu")}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
            >
              <img
                src={user?.avatar || "https://i.pravatar.cc/40"}
                alt=""
                width={32}
                height={32}
              />
            </button>
          ) : (
            <Link
              href={accountHref}
              className="zh-nav__profile"
              aria-label={user ? t("profile") : t("signIn")}
            >
              <img
                src={user?.avatar || "https://i.pravatar.cc/40"}
                alt=""
                width={28}
                height={28}
              />
              <div className="zh-nav__profile-copy">
                <strong>
                  {t("hiUser", { name: displayName || "User" })}
                </strong>
                <span className="zh-nav__premium">
                  {t("premium")}
                  <Crown size={11} aria-hidden />
                </span>
              </div>
            </Link>
          )}
        </div>
      </div>

      <ZorinoHomeMobileMenu
        open={menuOpen}
        onClose={closeMenu}
        accountHref={accountHref}
        accountLabel={accountLabel}
      />
    </header>
  );
}
