import Link from "next/link";
import {
  Bell,
  ChevronDown,
  Crown,
  Heart,
  Search,
} from "lucide-react";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { ZORINO_LOGO_SOURCE } from "@/lib/assets";

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
          <img src={ZORINO_LOGO_SOURCE} alt="ZORINO" width={118} height={40} />
          <span className="zh-nav__tagline">Find Better Deals Faster</span>
        </Link>

        <nav className="zh-nav__links" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="zh-nav__link">
              {link.label}
              {"chevron" in link && link.chevron ? (
                <ChevronDown size={14} aria-hidden />
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="zh-nav__actions">
          <Link href="/search" className="zh-nav__icon-btn" aria-label="Search">
            <Search size={18} />
          </Link>
          <ThemeSwitcher />
          <Link href="/wishlist" className="zh-nav__icon-btn">
            <Heart size={18} aria-hidden />
            Wishlist
          </Link>
          <Link href="/notifications" className="zh-nav__icon-btn" aria-label="Notifications">
            <Bell size={18} aria-hidden />
            <span className="zh-nav__badge">3</span>
          </Link>
          <Link href="/profile" className="zh-nav__profile">
            <img src="https://i.pravatar.cc/40" alt="" width={32} height={32} />
            <div>
              <strong>Hi, Ahmed</strong>
              <span className="zh-nav__premium">
                <Crown size={11} aria-hidden />
                Premium
              </span>
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
