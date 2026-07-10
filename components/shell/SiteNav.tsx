"use client";

import { Link } from "@/i18n/navigation";
import {
  Bell,
  Crown,
  Heart,
  Search,
} from "lucide-react";
import { useTranslations } from "next-intl";
import IntlNavSelectors from "@/components/international/IntlNavSelectors";
import SiteNavMenu from "@/components/shell/SiteNavMenu";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { ZORINO_LOGO_SOURCE } from "@/lib/assets";

export default function SiteNav() {
  const t = useTranslations("common");
  const tHero = useTranslations("hero");

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
          <Link href="/wishlist" className="zor-nav__icon-btn">
            <Heart size={18} aria-hidden />
            {t("wishlist")}
          </Link>
          <Link
            href="/notifications"
            className="zor-nav__icon-btn"
            aria-label={t("notifications")}
          >
            <Bell size={18} aria-hidden />
            <span className="zor-nav__badge">3</span>
          </Link>
          <Link href="/profile" className="zor-nav__profile">
            <img src="https://i.pravatar.cc/40" alt="" width={32} height={32} />
            <div>
              <strong>{t("hiUser", { name: "Ahmed" })}</strong>
              <span className="zor-nav__premium">
                <Crown size={11} aria-hidden />
                {t("premium")}
              </span>
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
