import Link from "next/link";
import { Search, Heart, Bell, ChevronDown, Crown } from "lucide-react";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { ZorinoLogo } from "@/components/ZorinoLogo";

const navLinks = [
  { href: "/deals", label: "Deals" },
  { href: "/coupons", label: "Coupons" },
  { href: "/compare", label: "Compare" },
  { href: "/categories", label: "Categories", chevron: true },
  { href: "/stores", label: "Stores" },
  { href: "/blog", label: "Blog" },
];

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="logo">
          <ZorinoLogo className="logo-lockup" />
        </Link>

        <div className="nav-links">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="nav-link">
              {link.label}
              {link.chevron && <ChevronDown size={14} className="nav-chevron" />}
            </Link>
          ))}
        </div>

        <div className="nav-actions">
          <button type="button" className="icon-btn" aria-label="Search">
            <Search size={18} />
          </button>
          <ThemeSwitcher />
          <Link href="/wishlist" className="icon-btn nav-wishlist" aria-label="Wishlist">
            <Heart size={18} />
            <span>Wishlist</span>
          </Link>
          <Link href="/notifications" className="icon-btn icon-btn-badge" aria-label="Notifications">
            <Bell size={18} />
            <span className="notification-badge">3</span>
          </Link>
          <Link href="/profile" className="profile-box">
            <img src="https://i.pravatar.cc/40" alt="Profile" />
            <div>
              <strong>Hi, Ahmed</strong>
              <p className="premium-badge">
                <Crown size={11} />
                Premium
              </p>
            </div>
          </Link>
        </div>
      </div>
    </nav>
  );
}
