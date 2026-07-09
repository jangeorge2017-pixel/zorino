import Link from "next/link";
import {
  Bell,
  Crown,
  Heart,
  Search,
} from "lucide-react";
import IntlNavSelectors from "@/components/international/IntlNavSelectors";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { ZorinoLogo } from "@/components/ZorinoLogo";
import ZorinoHomeNavLinks from "@/components/zorino-home/ZorinoHomeNavLinks";
import "./nav.css";

export default function ZorinoHomeNav() {
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
            aria-label="Search"
          >
            <Search size={17} strokeWidth={2} />
          </Link>
        </div>

        <div className="zh-nav__actions">
          <IntlNavSelectors />
          <ThemeSwitcher />
          <Link href="/wishlist" className="zh-nav__icon-btn zh-nav__wishlist">
            <Heart size={17} strokeWidth={2} aria-hidden />
            <span className="zh-nav__wishlist-label">Wishlist</span>
          </Link>
          <Link
            href="/notifications"
            className="zh-nav__icon-btn zh-nav__icon-btn--square"
            aria-label="Notifications"
          >
            <Bell size={17} strokeWidth={2} aria-hidden />
            <span className="zh-nav__badge">3</span>
          </Link>
          <Link href="/profile" className="zh-nav__profile">
            <img src="https://i.pravatar.cc/40" alt="" width={28} height={28} />
            <div className="zh-nav__profile-copy">
              <strong>Hi, Ahmed</strong>
              <span className="zh-nav__premium">
                Premium
                <Crown size={11} aria-hidden />
              </span>
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
