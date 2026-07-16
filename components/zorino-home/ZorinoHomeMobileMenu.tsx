"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { HOME_NAV_LINKS } from "@/components/zorino-home/ZorinoHomeNavLinks";

type ZorinoHomeMobileMenuProps = {
  open: boolean;
  onClose: () => void;
  accountHref: string;
  accountLabel: string;
};

function isLinkActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

export default function ZorinoHomeMobileMenu({
  open,
  onClose,
  accountHref,
  accountLabel,
}: ZorinoHomeMobileMenuProps) {
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>("a")?.focus();
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const menuLinks = [
    ...HOME_NAV_LINKS.map((link) => ({
      href: link.href,
      label: tNav(link.key),
    })),
    { href: accountHref, label: accountLabel },
    { href: "/settings", label: tCommon("settings") },
  ];

  return createPortal(
    <>
      <div className="zh-nav-mobile-menu__backdrop" aria-hidden onClick={onClose} />
      <div
        ref={panelRef}
        className="zh-nav-mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="zh-nav-mobile-menu__header">
          <h2 id={titleId} className="zh-nav-mobile-menu__title">
            {tCommon("primaryNav")}
          </h2>
          <button
            type="button"
            className="zh-nav-mobile-menu__close"
            onClick={onClose}
            aria-label={tCommon("close")}
          >
            ×
          </button>
        </div>
        <nav className="zh-nav-mobile-menu__nav" aria-label={tCommon("primaryNav")}>
          {menuLinks.map((link) => {
            const active = isLinkActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`zh-nav-mobile-menu__link${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={onClose}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>,
    document.body,
  );
}
