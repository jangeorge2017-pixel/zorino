import Link from "next/link";
import {
  Search,
  Heart,
  Bell,
  ChevronDown,
  Crown,
  Moon,
  Sun,
} from "lucide-react";
import { ZORINO_LOGO_SOURCE } from "@/lib/assets";

const LINKS = [
  { href: "/deals", label: "Deals" },
  { href: "/coupons", label: "Coupons" },
  { href: "/compare", label: "Compare" },
  { href: "/categories", label: "Categories", chevron: true },
  { href: "/stores", label: "Stores" },
  { href: "/blog", label: "Blog" },
] as const;

export default function ZorinoBlueprintNav() {
  return (
    <header className="zb-nav">
      <div className="zb-nav-inner">
        <Link href="/" className="zb-logo">
          <img src={ZORINO_LOGO_SOURCE} alt="ZORINO" width={118} height={40} />
          <span className="zb-logo-tagline">Find Better Deals Faster</span>
        </Link>

        <nav className="zb-nav-links" aria-label="Primary">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="zb-nav-link">
              {link.label}
              {"chevron" in link && link.chevron ? (
                <ChevronDown size={14} aria-hidden />
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="zb-nav-actions">
          <button type="button" className="zb-icon-btn" aria-label="Search">
            <Search size={18} />
          </button>
          <div className="zb-theme-toggle" aria-label="Theme">
            <span className="zb-theme-opt zb-theme-opt--active">
              <Moon size={14} aria-hidden /> Dark
            </span>
            <span className="zb-theme-opt">
              <Sun size={14} aria-hidden /> Light
            </span>
          </div>
          <Link href="/wishlist" className="zb-icon-btn" aria-label="Wishlist">
            <Heart size={18} />
            Wishlist
          </Link>
          <Link href="/notifications" className="zb-icon-btn" aria-label="Notifications">
            <Bell size={18} />
            <span className="zb-badge-count">3</span>
          </Link>
          <Link href="/profile" className="zb-profile">
            <img src="https://i.pravatar.cc/40" alt="" width={32} height={32} />
            <div>
              <strong>Hi, Ahmed</strong>
              <span className="zb-premium">
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
