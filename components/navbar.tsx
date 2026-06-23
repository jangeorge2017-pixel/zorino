import Link from "next/link";
import Image from "next/image";
import {
  Search,
  Heart,
  Bell,
  ChevronDown,
  Crown,
} from "lucide-react";
import ThemeSwitcher from "@/components/ThemeSwitcher";

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
    <nav className="h-[88px] px-8 flex items-center justify-between bg-[#060816] border-b border-white/10">

      {/* Logo */}
      <Link href="/" className="flex items-center shrink-0">
        <Image
          src="/logo.png"
          alt="ZORINO"
          width={235}
          height={82}
          priority
          className="w-[235px] h-[82px] object-contain"
        />
      </Link>

      {/* Center Navigation */}
      <div className="hidden lg:flex items-center gap-10">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-1 text-white text-[16px] font-medium hover:text-violet-400 transition"
          >
            {link.label}
            {link.chevron && <ChevronDown size={14} />}
          </Link>
        ))}
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-3">

        {/* Search */}
        <button
          aria-label="Search"
          className="w-12 h-12 rounded-2xl border border-white/10 bg-white/[0.03]
          flex items-center justify-center text-white hover:bg-white/10 transition"
        >
          <Search size={20} />
        </button>

        {/* Dark / Light */}
        <div className="hidden md:flex">
          <ThemeSwitcher />
        </div>

        {/* Wishlist */}
        <Link
          href="/wishlist"
          className="hidden md:flex items-center gap-2 px-5 h-12 rounded-2xl border border-white/10 bg-white/[0.03]
          text-white hover:bg-white/10 transition"
        >
          <Heart size={18} />
          <span className="text-sm font-medium">
            Wishlist
          </span>
        </Link>

        {/* Notifications */}
        <Link
          href="/notifications"
          className="relative w-12 h-12 rounded-2xl border border-white/10 bg-white/[0.03]
          flex items-center justify-center text-white hover:bg-white/10 transition"
        >
          <Bell size={19} />

          <span
            className="absolute -top-1 -right-1
            w-5 h-5 rounded-full bg-violet-600
            text-[10px] font-semibold text-white
            flex items-center justify-center"
          >
            3
          </span>
        </Link>

        {/* Profile */}
        <Link
          href="/profile"
          className="hidden lg:flex items-center gap-3
          pl-2 pr-4 py-2 rounded-2xl
          border border-white/10 bg-white/[0.03]
          hover:bg-white/10 transition"
        >
          <img
            src="https://i.pravatar.cc/40"
            alt="Profile"
            className="w-10 h-10 rounded-full"
          />

          <div className="leading-tight">
            <div className="text-white text-sm font-semibold">
              Hi, Ahmed
            </div>

            <div className="flex items-center gap-1 text-[12px] text-violet-400">
              <Crown size={11} />
              Premium
            </div>
          </div>
        </Link>
      </div>
    </nav>
  );
}