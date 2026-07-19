"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import {
  Crown,
  UserRound,
  ShoppingBag,
  Columns2,
  Settings,
  LogOut,
  X,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/auth-context";

type ZorinoHomeMobileMenuProps = {
  open: boolean;
  onClose: () => void;
  accountHref: string;
  displayName: string;
};

function isLinkActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Z";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export default function ZorinoHomeMobileMenu({
  open,
  onClose,
  accountHref,
  displayName,
}: ZorinoHomeMobileMenuProps) {
  const pathname = usePathname();
  const tCommon = useTranslations("common");
  const { logout } = useAuth();
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
    if (open) panelRef.current?.querySelector<HTMLElement>("a,button")?.focus();
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const handleLogout = () => {
    logout();
    onClose();
  };

  const links = [
    { href: accountHref, label: tCommon("profile"), icon: UserRound },
    { href: "/cart", label: tCommon("orders"), icon: ShoppingBag },
    { href: "/compare", label: tCommon("compare"), icon: Columns2 },
    { href: "/settings", label: tCommon("settings"), icon: Settings },
  ] as const;

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
        <header className="zh-nav-mobile-menu__header">
          <div className="zh-nav-mobile-menu__identity">
            <div className="zh-nav-mobile-menu__avatar" aria-hidden>
              <span>{initialsFromName(displayName)}</span>
            </div>
            <div className="zh-nav-mobile-menu__identity-copy">
              <p id={titleId} className="zh-nav-mobile-menu__hello">
                {tCommon("hiUser", { name: displayName })}
              </p>
              <span className="zh-nav-mobile-menu__premium-inline">
                <Crown size={12} aria-hidden />
                {tCommon("premium")}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="zh-nav-mobile-menu__close"
            onClick={onClose}
            aria-label={tCommon("close")}
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <nav
          className="zh-nav-mobile-menu__section"
          aria-label={tCommon("account")}
        >
          <p className="zh-nav-mobile-menu__heading">{tCommon("account")}</p>
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`zh-nav-mobile-menu__link${
                isLinkActive(pathname, href) ? " is-active" : ""
              }`}
              onClick={onClose}
            >
              <span className="zh-nav-mobile-menu__link-icon" aria-hidden>
                <Icon size={18} strokeWidth={2.1} />
              </span>
              <span className="zh-nav-mobile-menu__link-label">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="zh-nav-mobile-menu__footer">
          <button
            type="button"
            className="zh-nav-mobile-menu__logout"
            onClick={handleLogout}
          >
            <LogOut size={17} aria-hidden />
            {tCommon("logout")}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
