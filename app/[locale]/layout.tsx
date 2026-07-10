import { notFound } from "next/navigation";
import { getMessages } from "next-intl/server";
import LocaleShell from "@/components/shell/LocaleShell";
import DocumentAttributes from "@/components/international/DocumentAttributes";
import IntlClientProvider from "@/components/international/IntlClientProvider";
import { IntlPreferencesProvider } from "@/components/international/IntlPreferencesProvider";
import { AuthProvider } from "@/lib/auth/auth-context";
import AppThemeProvider from "@/components/AppThemeProvider";
import { locales, type Locale } from "@/i18n/config";
import {
  getServerIntlPreferences,
  preferencesToJson,
} from "@/lib/international/preferences";
import { languages } from "@/lib/international/config";

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  const activeLocale = locale as Locale;
  const messages = await getMessages();
  const prefs = await getServerIntlPreferences(activeLocale);
  const dir = languages[activeLocale]?.dir ?? "ltr";

  return (
    <IntlClientProvider locale={activeLocale} messages={messages}>
      <DocumentAttributes locale={activeLocale} />
      <AuthProvider>
        <AppThemeProvider>
          <IntlPreferencesProvider initial={preferencesToJson(prefs)}>
            <div lang={activeLocale} dir={dir}>
              <LocaleShell>{children}</LocaleShell>
            </div>
          </IntlPreferencesProvider>
        </AppThemeProvider>
      </AuthProvider>
    </IntlClientProvider>
  );
}
