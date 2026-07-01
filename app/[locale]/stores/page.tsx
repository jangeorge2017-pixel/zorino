import StoresPageClient from "@/components/StoresPageClient";
import { getMockStoresForPage } from "@/lib/mock/page-data";
import { getServerIntlPreferences } from "@/lib/international/preferences";
import type { Locale } from "@/i18n/config";

type StoresPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function StoresPage({ params }: StoresPageProps) {
  const { locale } = await params;
  const prefs = await getServerIntlPreferences(locale as Locale);
  const stores = getMockStoresForPage(prefs.countryCode);
  return <StoresPageClient stores={stores} />;
}
