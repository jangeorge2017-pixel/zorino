"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, Globe } from "lucide-react";
import { locales, type Locale } from "@/i18n/config";
import { getPathname, usePathname, useRouter } from "@/i18n/navigation";
import {
  currencies,
  languages,
  listCountries,
  listCurrencies,
  type CountryCode,
  type CurrencyCode,
} from "@/lib/international/config";
import { useIntlPreferences } from "@/components/international/IntlPreferencesProvider";
import { INTL_COOKIE_LOCALE, INTL_COOKIE_MAX_AGE } from "@/lib/international/cookies";
import "./intl-selectors.css";

type PanelCoords = {
  top: number;
  left: number;
};

function writeLocaleCookies(nextLocale: Locale) {
  const maxAge = INTL_COOKIE_MAX_AGE;
  // next-intl cookie — must be updated before landing on unprefixed `/`
  document.cookie = `NEXT_LOCALE=${nextLocale}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
  document.cookie = `${INTL_COOKIE_LOCALE}=${nextLocale}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export default function IntlNavSelectors() {
  const t = useTranslations("common");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const { country, currency, updatePreferences, isUpdating } = useIntlPreferences();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<PanelCoords>({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const panelWidth = Math.min(300, window.innerWidth - 24);
    const gap = 8;
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      setCoords({
        top: Math.min(rect.bottom + gap, window.innerHeight - 24),
        left: 12,
      });
      return;
    }

    let left = rect.right - panelWidth;
    left = Math.max(12, Math.min(left, window.innerWidth - panelWidth - 12));

    const estimatedHeight = 420;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const openUpward = spaceBelow < Math.min(estimatedHeight, 280) && rect.top > spaceBelow;
    const top = openUpward
      ? Math.max(12, rect.top - gap - Math.min(estimatedHeight, spaceBelow + rect.height))
      : rect.bottom + gap;

    setCoords({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleReposition = () => updatePosition();

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open, updatePosition]);

  const switchLocale = (newLocale: Locale) => {
    if (newLocale === locale) {
      setOpen(false);
      return;
    }
    setOpen(false);

    writeLocaleCookies(newLocale);

    // Persist preference without blocking navigation.
    void updatePreferences({ locale: newLocale }, { skipNavigation: true }).catch(
      () => undefined
    );

    // forcePrefix: true → /en or /en/... so middleware updates locale state,
    // then as-needed redirects default locale to unprefixed `/`.
    const href = getPathname({
      href: pathname || "/",
      locale: newLocale,
      forcePrefix: true,
    });

    // Full navigation avoids stale App Router RSC/locale cache on AR↔EN.
    window.location.assign(href);
  };

  const handleCountryChange = async (code: CountryCode) => {
    setOpen(false);
    // Country/currency only — language stays independent (no locale redirect).
    await updatePreferences({ countryCode: code }, { skipNavigation: true });
    router.refresh();
  };

  const handleCurrencyChange = async (code: CurrencyCode) => {
    setOpen(false);
    await updatePreferences({ currencyCode: code }, { skipNavigation: true });
    router.refresh();
  };

  const langLabel = locale.toUpperCase();

  const panel =
    open && mounted
      ? createPortal(
          <>
            <div
              className="zor-intl__backdrop"
              aria-hidden
              onClick={() => setOpen(false)}
            />
            <div
              ref={panelRef}
              className="zor-intl__panel"
              role="dialog"
              aria-label={t("regionPreferences")}
              style={{ top: coords.top, left: coords.left }}
            >
              <section className="zor-intl__section">
                <p className="zor-intl__heading">{t("language")}</p>
                <div className="zor-intl__options">
                  {locales.map((code) => (
                    <button
                      key={code}
                      type="button"
                      role="menuitemradio"
                      aria-checked={locale === code}
                      className={`zor-intl__option${locale === code ? " zor-intl__option--active" : ""}`}
                      onClick={() => switchLocale(code)}
                    >
                      <span>{languages[code].flag}</span>
                      {languages[code].nativeLabel}
                    </button>
                  ))}
                </div>
              </section>

              <section className="zor-intl__section">
                <p className="zor-intl__heading">{t("country")}</p>
                <div className="zor-intl__options zor-intl__options--scroll">
                  {listCountries().map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      role="menuitemradio"
                      aria-checked={country.code === item.code}
                      className={`zor-intl__option${country.code === item.code ? " zor-intl__option--active" : ""}`}
                      onClick={() => handleCountryChange(item.code)}
                    >
                      <span>{item.flag}</span>
                      {item.name}
                    </button>
                  ))}
                </div>
              </section>

              <section className="zor-intl__section">
                <p className="zor-intl__heading">{t("currency")}</p>
                <div className="zor-intl__options zor-intl__options--scroll">
                  {listCurrencies().map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      role="menuitemradio"
                      aria-checked={currency.code === item.code}
                      className={`zor-intl__option${currency.code === item.code ? " zor-intl__option--active" : ""}`}
                      onClick={() => handleCurrencyChange(item.code)}
                    >
                      <span>{currencies[item.code].symbol}</span>
                      {item.code} — {item.name}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <div className="zor-intl" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="zor-intl__trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t("regionPreferences")}
        disabled={isUpdating}
      >
        <Globe size={16} aria-hidden />
        <span className="zor-intl__trigger-label">
          {langLabel} · {currency.code}
        </span>
        <ChevronDown size={14} className={open ? "zor-intl__chevron-open" : ""} aria-hidden />
      </button>
      {panel}
    </div>
  );
}
