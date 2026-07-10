import StoresPageClient from "@/components/StoresPageClient";
import { getStoresForPage } from "@/lib/data/homepage";
import { locales, type Locale } from "@/i18n/config";
import type { CountryCode } from "@/lib/international/config";
import { filterStoresByMarketplaceVisibility } from "@/lib/international/stores";
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
  // Only surface AliExpress as a live product store — no Amazon/Best Buy mock catalogs.
  const aliexpressOnly = liveStores.filter((s) => s.slug === "aliexpress" || s.integrationType === "aliexpress");
  if (aliexpressOnly.length > 0) {
    return filterStoresByMarketplaceVisibility(aliexpressOnly, countryCode);
  }
  return [
    {
      id: "aliexpress",
      name: "AliExpress",
      slug: "aliexpress",
      website: "https://www.aliexpress.com",
      integrationType: "aliexpress",
      commissionRate: 5,
      supportedRegions: ["US", "GB", "DE", "FR", "ES", "IT", "AE", "SA", "EG"],
      supportedCurrencies: ["USD", "EUR", "GBP", "AED", "SAR", "EGP"],
      isActive: true,
      logoInitial: "AE",
    },
  ];
}

export default async function StoresPage({ params }: StoresPageProps) {
  const { locale } = await params;
  const prefs = await getServerIntlPreferences(resolveLocale(locale));
  const stores = await loadStores(prefs.countryCode);

  return <StoresPageClient stores={stores} />;
}
