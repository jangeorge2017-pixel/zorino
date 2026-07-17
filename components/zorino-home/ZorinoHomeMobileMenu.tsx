"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Crown } from "lucide-react";
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
        <div className="zh-nav-mobile-menu__user">
          <p id={titleId} className="zh-nav-mobile-menu__hello">
            {tCommon("hiUser", { name: displayName })}
            <span className="zh-nav-mobile-menu__premium-inline">
              <Crown size={13} aria-hidden />
              {tCommon("premium")}
            </span>
          </p>
        </div>

        <nav className="zh-nav-mobile-menu__section zh-nav-mobile-menu__section--flush" aria-label={tCommon("account")}>
          <Link
            href={accountHref}
            className={`zh-nav-mobile-menu__link${isLinkActive(pathname, accountHref) ? " is-active" : ""}`}
            onClick={onClose}
          >
            {tCommon("profile")}
          </Link>
          <Link
            href="/cart"
            className={`zh-nav-mobile-menu__link${isLinkActive(pathname, "/cart") ? " is-active" : ""}`}
            onClick={onClose}
          >
            {tCommon("orders")}
          </Link>
          <Link
            href="/compare"
            className={`zh-nav-mobile-menu__link${isLinkActive(pathname, "/compare") ? " is-active" : ""}`}
            onClick={onClose}
          >
            {tCommon("compare")}
          </Link>
          <Link
            href="/settings"
            className={`zh-nav-mobile-menu__link${isLinkActive(pathname, "/settings") ? " is-active" : ""}`}
            onClick={onClose}
          >
            {tCommon("settings")}
          </Link>
          <button
            type="button"
            className="zh-nav-mobile-menu__link zh-nav-mobile-menu__link--button"
            onClick={handleLogout}
          >
            {tCommon("logout")}
          </button>
        </nav>
      </div>
    </>,
    document.body,
  );
}
