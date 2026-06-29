import Link from "next/link";
import {
  Bell,
  ChevronDown,
  Crown,
  Heart,
  Search,
} from "lucide-react";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { ZorinoLogo } from "@/components/ZorinoLogo";
import "./nav.css";

const NAV_LINKS = [
  { href: "/deals", label: "Deals" },
  { href: "/coupons", label: "Coupons" },
  { href: "/compare", label: "Compare" },
  { href: "/categories", label: "Categories", chevron: true },
  { href: "/stores", label: "Stores" },
  { href: "/blog", label: "Blog" },
] as const;

export default function ZorinoHomeNav() {
  return (
    <header className="zh-nav">
      <div className="zh-nav__inner">
        <Link href="/" className="zh-nav__logo">
          <ZorinoLogo className="zh-nav__logo-lockup" />
        </Link>

        <nav className="zh-nav__links" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="zh-nav__link">
              {link.label}
              {"chevron" in link && link.chevron ? (
                <ChevronDown size={14} className="zh-nav__chevron" aria-hidden />
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="zh-nav__actions">
          <Link href="/search" className="zh-nav__icon-btn" aria-label="Search">
            <Search size={18} strokeWidth={2} />
          </Link>
          <ThemeSwitcher />
          <Link href="/wishlist" className="zh-nav__icon-btn zh-nav__wishlist">
            <Heart size={18} strokeWidth={2} aria-hidden />
            Wishlist
          </Link>
          <Link
            href="/notifications"
            className="zh-nav__icon-btn"
            aria-label="Notifications"
          >
            <Bell size={18} strokeWidth={2} aria-hidden />
            <span className="zh-nav__badge">3</span>
          </Link>
          <Link href="/profile" className="zh-nav__profile">
            <img src="https://i.pravatar.cc/40" alt="" width={32} height={32} />
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
