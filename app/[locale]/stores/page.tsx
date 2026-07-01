import StoresPageClient from "@/components/StoresPageClient";
import { getStoresForPage } from "@/lib/data/homepage";
import { getMockStoresForPage } from "@/lib/mock/page-data";
import { locales, type Locale } from "@/i18n/config";
import type { CountryCode } from "@/lib/international/config";
import { filterStoresByCountry } from "@/lib/international/stores";
import { getServerIntlPreferences } from "@/lib/international/preferences";
import type { Store } from "@/lib/types/entities";

type StoresPageProps = {
  params: Promise<{ locale: string }>;
};

export const dynamic = "force-dynamic";

function resolveLocale(value: string): Locale {
  return locales.includes(value as Locale) ? (value as Locale) : "en";
}

async function loadStores(countryCode: CountryCode): Promise<Store[]> {
  const liveStores = await getStoresForPage();
  const source = liveStores.length > 0 ? liveStores : getMockStoresForPage(countryCode);
  return filterStoresByCountry(source, countryCode);
}

export default async function StoresPage({ params }: StoresPageProps) {
  const { locale } = await params;
  const prefs = await getServerIntlPreferences(resolveLocale(locale));
  const stores = await loadStores(prefs.countryCode);

  return <StoresPageClient stores={stores} />;
}
