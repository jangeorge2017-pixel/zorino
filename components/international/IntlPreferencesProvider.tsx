"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";
import type { CountryCode, CurrencyCode } from "@/lib/international/config";
import { formatCurrency as formatCurrencyValue } from "@/lib/international/format";
import { writeIntlToLocalStorage } from "@/lib/global-marketplace/preferences/storage";

export type IntlPreferencesSnapshot = {
  country: { code: CountryCode; name: string; flag: string };
  currency: { code: CurrencyCode; symbol: string; name: string };
  locale: Locale;
};

type IntlPreferencesContextValue = IntlPreferencesSnapshot & {
  formatPrice: (amount: number, fromCurrency?: CurrencyCode) => string;
  updatePreferences: (prefs: {
    countryCode?: CountryCode;
    currencyCode?: CurrencyCode;
  }) => Promise<void>;
  isUpdating: boolean;
};

const IntlPreferencesContext = createContext<IntlPreferencesContextValue | null>(null);

type IntlPreferencesProviderProps = {
  initial: IntlPreferencesSnapshot;
  children: ReactNode;
};

export function IntlPreferencesProvider({ initial, children }: IntlPreferencesProviderProps) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initial);
  const [isUpdating, setIsUpdating] = useState(false);

  const updatePreferences = useCallback(
    async (prefs: { countryCode?: CountryCode; currencyCode?: CurrencyCode }) => {
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
        router.refresh();
      } finally {
        setIsUpdating(false);
      }
    },
    [router]
  );

  const formatPrice = useCallback(
    (amount: number, fromCurrency?: CurrencyCode) =>
      formatCurrencyValue(amount, snapshot.currency.code, {
        fromCurrency,
        locale: snapshot.locale === "ar" ? "ar" : undefined,
      }),
    [snapshot.currency.code, snapshot.locale]
  );

  const value = useMemo(
    () => ({
      ...snapshot,
      formatPrice,
      updatePreferences,
      isUpdating,
    }),
    [snapshot, formatPrice, updatePreferences, isUpdating]
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
