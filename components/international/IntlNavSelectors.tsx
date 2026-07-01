"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { ChevronDown, Globe } from "lucide-react";
import { locales, type Locale } from "@/i18n/config";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  currencies,
  languages,
  listCountries,
  listCurrencies,
  type CountryCode,
  type CurrencyCode,
} from "@/lib/international/config";
import { useIntlPreferences } from "@/components/international/IntlPreferencesProvider";
import "./intl-selectors.css";

export default function IntlNavSelectors() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const { country, currency, updatePreferences, isUpdating } = useIntlPreferences();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const switchLocale = (newLocale: Locale) => {
    router.replace(pathname, { locale: newLocale });
    setOpen(false);
  };

  const handleCountryChange = async (code: CountryCode) => {
    await updatePreferences({ countryCode: code });
    setOpen(false);
  };

  const handleCurrencyChange = async (code: CurrencyCode) => {
    await updatePreferences({ currencyCode: code });
    setOpen(false);
  };

  const langLabel = languages[locale].nativeLabel.slice(0, 2).toUpperCase();

  return (
    <div className="zor-intl" ref={panelRef}>
      <button
        type="button"
        className="zor-intl__trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Language, country, and currency"
        disabled={isUpdating}
      >
        <Globe size={16} aria-hidden />
        <span className="zor-intl__trigger-label">
          {langLabel} · {currency.code}
        </span>
        <ChevronDown size={14} className={open ? "zor-intl__chevron-open" : ""} aria-hidden />
      </button>

      {open ? (
        <div className="zor-intl__panel" role="menu">
          <section className="zor-intl__section">
            <p className="zor-intl__heading">Language</p>
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
            <p className="zor-intl__heading">Country</p>
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
            <p className="zor-intl__heading">Currency</p>
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
      ) : null}
    </div>
  );
}
