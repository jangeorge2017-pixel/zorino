"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { usePathname } from "@/i18n/navigation";

const NAV_LINKS = [
  { href: "/deals", label: "Deals" },
  { href: "/coupons", label: "Coupons" },
  { href: "/compare", label: "Compare" },
  { href: "/categories", label: "Categories", chevron: true },
  { href: "/stores", label: "Stores" },
  { href: "/blog", label: "Blog" },
] as const;

function isLinkActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

export default function ZorinoHomeNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="zh-nav__links" aria-label="Primary">
      {NAV_LINKS.map((link) => {
        const active = isLinkActive(pathname, link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`zh-nav__link${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="zh-nav__link-text">
              {link.label}
              {"chevron" in link && link.chevron ? (
                <ChevronDown size={14} className="zh-nav__chevron" aria-hidden />
              ) : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
