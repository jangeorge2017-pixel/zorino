"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Link, getPathname, usePathname } from "@/i18n/navigation";
import { locales, type Locale } from "@/i18n/config";
import { languages } from "@/lib/international/config";
import { useIntlPreferences } from "@/components/international/IntlPreferencesProvider";
import { INTL_COOKIE_LOCALE, INTL_COOKIE_MAX_AGE } from "@/lib/international/cookies";
import { HOME_NAV_LINKS } from "@/components/zorino-home/ZorinoHomeNavLinks";
import { useAuth } from "@/lib/auth/auth-context";

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

function writeLocaleCookies(nextLocale: Locale) {
  const maxAge = INTL_COOKIE_MAX_AGE;
  document.cookie = `NEXT_LOCALE=${nextLocale}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
  document.cookie = `${INTL_COOKIE_LOCALE}=${nextLocale}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export default function ZorinoHomeMobileMenu({
  open,
  onClose,
  accountHref,
  accountLabel,
}: ZorinoHomeMobileMenuProps) {
  const pathname = usePathname();
  const locale = useLocale() as Locale;
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const { user, logout } = useAuth();
  const { updatePreferences } = useIntlPreferences();
  const { resolvedTheme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setThemeMounted(true);
  }, []);

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

  const isDark = !themeMounted || resolvedTheme !== "light";

  const switchLocale = (newLocale: Locale) => {
    if (newLocale === locale) {
      onClose();
      return;
    }
    writeLocaleCookies(newLocale);
    void updatePreferences({ locale: newLocale }, { skipNavigation: true }).catch(
      () => undefined,
    );
    const href = getPathname({
      href: pathname || "/",
      locale: newLocale,
      forcePrefix: true,
    });
    window.location.assign(href);
  };

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
        <div className="zh-nav-mobile-menu__header">
          <h2 id={titleId} className="zh-nav-mobile-menu__title">
            {tCommon("menu")}
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
          {HOME_NAV_LINKS.map((link) => {
            const active = isLinkActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`zh-nav-mobile-menu__link${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={onClose}
              >
                {tNav(link.key)}
              </Link>
            );
          })}
        </nav>

        <div className="zh-nav-mobile-menu__section">
          <p className="zh-nav-mobile-menu__heading">{tCommon("account")}</p>
          <Link
            href={accountHref}
            className={`zh-nav-mobile-menu__link${isLinkActive(pathname, accountHref) ? " is-active" : ""}`}
            onClick={onClose}
          >
            {accountLabel}
          </Link>

          <div className="zh-nav-mobile-menu__row">
            <span className="zh-nav-mobile-menu__row-label">{tCommon("language")}</span>
            <div className="zh-nav-mobile-menu__chips" role="group" aria-label={tCommon("language")}>
              {locales.map((code) => (
                <button
                  key={code}
                  type="button"
                  className={`zh-nav-mobile-menu__chip${locale === code ? " is-active" : ""}`}
                  aria-pressed={locale === code}
                  onClick={() => switchLocale(code)}
                >
                  <span aria-hidden>{languages[code].flag}</span>
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="zh-nav-mobile-menu__row">
            <span className="zh-nav-mobile-menu__row-label">{tCommon("theme")}</span>
            <button
              type="button"
              className="zh-nav-mobile-menu__chip"
              aria-label={tCommon("theme")}
              onClick={() => setTheme(isDark ? "light" : "dark")}
            >
              {isDark ? <Sun size={14} aria-hidden /> : <Moon size={14} aria-hidden />}
              {isDark ? tCommon("light") : tCommon("dark")}
            </button>
          </div>

          <Link
            href="/settings"
            className={`zh-nav-mobile-menu__link${isLinkActive(pathname, "/settings") ? " is-active" : ""}`}
            onClick={onClose}
          >
            {tCommon("settings")}
          </Link>

          {user ? (
            <button
              type="button"
              className="zh-nav-mobile-menu__link zh-nav-mobile-menu__link--button"
              onClick={handleLogout}
            >
              {tCommon("logout")}
            </button>
          ) : null}
        </div>
      </div>
    </>,
    document.body,
  );
}
