import { NextResponse } from "next/server";
import { resolveStoreLogoSrc } from "@/lib/assets";
import { getStoresForPage } from "@/lib/data/homepage";

export const dynamic = "force-dynamic";

export async function GET() {
  const stores = await getStoresForPage();
  const payload = stores.map((store) => ({
    id: store.id,
    name: store.name,
    slug: store.slug,
    logo: store.logoUrl || resolveStoreLogoSrc(store.slug),
    badge: store.logoInitial || store.name.slice(0, 2).toUpperCase(),
    website: store.website,
    integrationType: store.integrationType,
    supportedRegions: store.supportedRegions,
    supportedCurrencies: store.supportedCurrencies,
    isActive: store.isActive,
  }));

  return NextResponse.json({
    stores: payload,
    total: payload.length,
  });
}
