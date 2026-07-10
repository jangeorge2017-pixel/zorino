"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

const NAV_LINKS = [
  { href: "/deals", key: "deals" as const },
  { href: "/coupons", key: "coupons" as const },
  { href: "/compare", key: "compare" as const },
  { href: "/categories", key: "categories" as const, chevron: true },
  { href: "/stores", key: "stores" as const },
  { href: "/blog", key: "blog" as const },
] as const;

function isLinkActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

export default function ZorinoHomeNavLinks() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");

  return (
    <nav className="zh-nav__links" aria-label={tCommon("primaryNav")}>
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
              {t(link.key)}
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
