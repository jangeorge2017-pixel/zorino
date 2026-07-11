"use client";

import {
  Bell,
  Crown,
  Heart,
  Search,
  User,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import IntlNavSelectors from "@/components/international/IntlNavSelectors";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { ZorinoLogo } from "@/components/ZorinoLogo";
import ZorinoHomeNavLinks from "@/components/zorino-home/ZorinoHomeNavLinks";
import { useAuth } from "@/lib/auth/auth-context";
import "./nav.css";

export default function ZorinoHomeNav() {
  const t = useTranslations("common");
  const { user } = useAuth();
  const displayName = user
    ? user.name.split(" ")[0] || user.name
    : null;

  return (
    <header className="zh-nav">
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
          <IntlNavSelectors />
          <ThemeSwitcher />
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
          <Link
            href={user ? "/profile" : "/auth/login"}
            className="zh-nav__profile"
            aria-label={user ? t("profile") : t("signIn")}
          >
            {user?.avatar ? (
              <img src={user.avatar} alt="" width={28} height={28} />
            ) : (
              <span className="zh-nav__profile-fallback" aria-hidden>
                <User size={16} strokeWidth={2} />
              </span>
            )}
            <div className="zh-nav__profile-copy">
              <strong>
                {displayName ? t("hiUser", { name: displayName }) : t("signIn")}
              </strong>
              <span className="zh-nav__premium">
                {t("premium")}
                <Crown size={11} aria-hidden />
              </span>
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
