import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import LocaleShell from "@/components/shell/LocaleShell";
import DocumentAttributes from "@/components/international/DocumentAttributes";
import { IntlPreferencesProvider } from "@/components/international/IntlPreferencesProvider";
import { locales, type Locale } from "@/i18n/config";
import {
  getServerIntlPreferences,
  preferencesToJson,
} from "@/lib/international/preferences";

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

  const messages = await getMessages();
  const prefs = await getServerIntlPreferences(locale as Locale);

  return (
    <NextIntlClientProvider messages={messages}>
      <DocumentAttributes locale={locale as Locale} />
      <IntlPreferencesProvider initial={preferencesToJson(prefs)}>
        <LocaleShell>{children}</LocaleShell>
      </IntlPreferencesProvider>
    </NextIntlClientProvider>
  );
}
