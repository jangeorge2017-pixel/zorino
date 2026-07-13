"use client";

import { Link } from "@/i18n/navigation";
import {
  Bell,
  Heart,
  Search,
  User,
} from "lucide-react";
import { useTranslations } from "next-intl";
import IntlNavSelectors from "@/components/international/IntlNavSelectors";
import SiteNavMenu from "@/components/shell/SiteNavMenu";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { useAuth } from "@/lib/auth/auth-context";
import { ZORINO_LOGO_SOURCE } from "@/lib/assets";

export default function SiteNav() {
  const t = useTranslations("common");
  const tHero = useTranslations("hero");
  const { user } = useAuth();

  return (
    <header className="zor-nav">
      <div className="zor-nav__inner">
        <Link href="/" className="zor-nav__logo">
          <img src={ZORINO_LOGO_SOURCE} alt="ZORINO" width={118} height={40} />
          <span className="zor-nav__tagline">{tHero("title")}</span>
        </Link>

        <nav className="zor-nav__links" aria-label={t("primaryNav")}>
          <SiteNavMenu />
        </nav>

        <div className="zor-nav__actions">
          <Link href="/search" className="zor-nav__icon-btn" aria-label={t("search")}>
            <Search size={18} />
          </Link>
          <IntlNavSelectors />
          <ThemeSwitcher />
          <Link href="/wishlist" className="zor-nav__icon-btn" aria-label={t("wishlist")}>
            <Heart size={18} aria-hidden />
            <span>{t("wishlist")}</span>
          </Link>
          <Link
            href="/notifications"
            className="zor-nav__icon-btn"
            aria-label={t("notifications")}
          >
            <Bell size={18} aria-hidden />
          </Link>
          <Link
            href={user ? "/profile" : "/auth/login"}
            className="zor-nav__profile"
            aria-label={user ? t("profile") : t("signIn")}
          >
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
    </header>
  );
}
