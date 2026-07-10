"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocale } from "next-intl";
import type { Locale } from "@/i18n/config";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { CountryCode, CurrencyCode } from "@/lib/international/config";
import { formatCurrency as formatCurrencyValue } from "@/lib/international/format";
import { writeIntlToLocalStorage } from "@/lib/global-marketplace/preferences/storage";

export type IntlPreferencesSnapshot = {
  country: { code: CountryCode; name: string; flag: string };
  currency: { code: CurrencyCode; symbol: string; name: string };
  locale: Locale;
};

type PreferenceUpdate = {
  countryCode?: CountryCode;
  currencyCode?: CurrencyCode;
  locale?: Locale;
};

type UpdateOptions = {
  /** Persist only — caller handles locale navigation (avoids double refresh). */
  skipNavigation?: boolean;
};

type IntlPreferencesContextValue = IntlPreferencesSnapshot & {
  formatPrice: (amount: number, fromCurrency?: CurrencyCode) => string;
  updatePreferences: (
    prefs: PreferenceUpdate,
    options?: UpdateOptions
  ) => Promise<IntlPreferencesSnapshot>;
  isUpdating: boolean;
};

const IntlPreferencesContext = createContext<IntlPreferencesContextValue | null>(null);

type IntlPreferencesProviderProps = {
  initial: IntlPreferencesSnapshot;
  children: ReactNode;
};

export function IntlPreferencesProvider({ initial, children }: IntlPreferencesProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const activeLocale = useLocale() as Locale;
  const [snapshot, setSnapshot] = useState(initial);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setSnapshot(initial);
  }, [initial]);

  const updatePreferences = useCallback(
    async (prefs: PreferenceUpdate, options?: UpdateOptions) => {
      setIsUpdating(true);
      try {
        const response = await fetch("/api/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(prefs),
        });

        if (!response.ok) {
          throw new Error("Failed to update preferences");
        }

        const data = (await response.json()) as IntlPreferencesSnapshot;
        setSnapshot(data);
        writeIntlToLocalStorage({
          countryCode: data.country.code,
          currencyCode: data.currency.code,
        });

        if (options?.skipNavigation) {
          return data;
        }

        const localeChangedByIntent =
          prefs.locale !== undefined || prefs.countryCode !== undefined;

        if (localeChangedByIntent && data.locale !== activeLocale) {
          router.replace(pathname, { locale: data.locale });
        } else {
          router.refresh();
        }

        return data;
      } finally {
        setIsUpdating(false);
      }
    },
    [activeLocale, pathname, router]
  );

  const formatPrice = useCallback(
    (amount: number, fromCurrency?: CurrencyCode) =>
      formatCurrencyValue(amount, snapshot.currency.code, {
        fromCurrency,
        locale: activeLocale === "ar" ? "ar" : undefined,
      }),
    [snapshot.currency.code, activeLocale]
  );

  const value = useMemo(
    () => ({
      ...snapshot,
      locale: activeLocale,
      formatPrice,
      updatePreferences,
      isUpdating,
    }),
    [snapshot, activeLocale, formatPrice, updatePreferences, isUpdating]
  );

  return (
    <IntlPreferencesContext.Provider value={value}>{children}</IntlPreferencesContext.Provider>
  );
}

export function useIntlPreferences(): IntlPreferencesContextValue {
  const context = useContext(IntlPreferencesContext);
  if (!context) {
    throw new Error("useIntlPreferences must be used within IntlPreferencesProvider");
  }
  return context;
}
