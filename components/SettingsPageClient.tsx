"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "@/lib/auth/auth-context";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { PageHeader, PageLayout } from "@/components/pages";
import { useIntlPreferences } from "@/components/international/IntlPreferencesProvider";
import { getPathname, usePathname } from "@/i18n/navigation";
import {
  listCountries,
  listCurrencies,
  languages,
  type CountryCode,
  type CurrencyCode,
} from "@/lib/international/config";
import type { Locale } from "@/i18n/config";
import { INTL_COOKIE_LOCALE, INTL_COOKIE_MAX_AGE } from "@/lib/international/cookies";
import { Bell, CheckCircle, Globe, Moon, Shield } from "lucide-react";

export default function SettingsPageClient() {
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { country, currency, updatePreferences } = useIntlPreferences();
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    locale: locale as Locale,
    currency: currency.code as CurrencyCode,
    country: country.code as CountryCode,
    emailNotifications: true,
    priceAlerts: true,
    dealDigest: false,
    theme: "dark",
  });

  useEffect(() => {
    setSettings((current) => ({
      ...current,
      locale,
      currency: currency.code,
      country: country.code,
    }));
  }, [locale, currency.code, country.code]);

  const handleSave = async () => {
    const nextLocale = settings.locale as Locale;
    const localeChanged = nextLocale !== locale;

    await updatePreferences(
      {
        countryCode: settings.country as CountryCode,
        currencyCode: settings.currency as CurrencyCode,
        ...(localeChanged ? { locale: nextLocale } : {}),
      },
      { skipNavigation: true }
    );

    if (localeChanged) {
      const maxAge = INTL_COOKIE_MAX_AGE;
      document.cookie = `NEXT_LOCALE=${nextLocale}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
      document.cookie = `${INTL_COOKIE_LOCALE}=${nextLocale}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
      window.location.assign(
        getPathname({
          href: pathname || "/",
          locale: nextLocale,
          forcePrefix: true,
        })
      );
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (!user) {
    return (
      <PageLayout>
        <div className="zor-page-state zor-page-state--empty">
          <h2 className="zor-page-state__title">{t("pleaseLogIn")}</h2>
          <p className="zor-page-state__text">{t("signInToManage")}</p>
          <Button onClick={() => router.push("/auth/login")} className="mt-4">
            {tCommon("login")}
          </Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title={tCommon("settings")}
        subtitle={t("accountSettings")}
        actions={
          <Button variant="outline" onClick={() => router.push("/profile")}>
            {tCommon("back")}
          </Button>
        }
      />

      {saved ? (
        <Card className="mb-6 border-green-500/30 bg-green-500/10">
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-5 h-5" />
            {tCommon("success")}
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <Globe className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">{t("regionalPreferences")}</h2>
          </div>
          <div className="space-y-4">
            <Select
              label={tCommon("language")}
              options={Object.values(languages).map((lang) => ({
                value: lang.code,
                label: lang.nativeLabel,
              }))}
              value={settings.locale}
              onChange={(e) =>
                setSettings({ ...settings, locale: e.target.value as Locale })
              }
            />
            <Select
              label={tCommon("currency")}
              options={listCurrencies().map((item) => ({
                value: item.code,
                label: `${item.code} (${item.symbol})`,
              }))}
              value={settings.currency}
              onChange={(e) =>
                setSettings({ ...settings, currency: e.target.value as CurrencyCode })
              }
            />
            <Select
              label={tCommon("country")}
              options={listCountries().map((item) => ({
                value: item.code,
                label: item.name,
              }))}
              value={settings.country}
              onChange={(e) =>
                setSettings({ ...settings, country: e.target.value as CountryCode })
              }
            />
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">{t("notifications")}</h2>
          </div>
          <div className="space-y-4">
            {[
              { key: "emailNotifications" as const, label: t("emailNotifications") },
              { key: "priceAlerts" as const, label: t("priceAlerts") },
              { key: "dealDigest" as const, label: t("dealDigest") },
            ].map((item) => (
              <label key={item.key} className="flex items-center justify-between gap-4 cursor-pointer">
                <span className="text-gray-300">{item.label}</span>
                <input
                  type="checkbox"
                  checked={settings[item.key]}
                  onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-600"
                />
              </label>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3 mb-6">
            <Moon className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">{t("theme")}</h2>
          </div>
          <Select
            label={t("theme")}
            options={[
              { value: "dark", label: t("dark") },
              { value: "light", label: t("light") },
              { value: "system", label: tCommon("recommended") },
            ]}
            value={settings.theme}
            onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
          />
        </Card>

        <Card>
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">{t("security")}</h2>
          </div>
          <div className="space-y-4">
            <Input label={tCommon("password")} type="password" placeholder="••••••••" />
            <Input label={t("changePassword")} type="password" placeholder="••••••••" />
            <Input label={tCommon("confirmPassword")} type="password" placeholder="••••••••" />
          </div>
        </Card>
      </div>

      <div className="mt-8 flex justify-end">
        <Button onClick={handleSave}>{t("save")}</Button>
      </div>
    </PageLayout>
  );
}
