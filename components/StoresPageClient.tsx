"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import StoresPageHero from "@/components/stores/StoresPageHero";
import StoresPageSection from "@/components/stores/StoresPageSection";
import StoresStoreCard from "@/components/stores/StoresStoreCard";
import { buildStoreSections } from "@/components/stores/store-sections";
import PageIdentityCta from "@/components/page-identity/PageIdentityCta";
import { PageEmptyState, PageFilterBar, PageLayout } from "@/components/pages";
import type { Store } from "@/lib/types/entities";
import Link from "next/link";
import "@/components/stores/stores-page.css";

type StoresPageClientProps = {
  stores: Store[];
};

type QuickFilter = "all" | "marketplace" | "partner" | "global";

const MARKETPLACE_TYPES = new Set(["amazon", "ebay", "aliexpress", "walmart", "noon"]);

const QUICK_FILTERS: { id: QuickFilter; label: string }[] = [
  { id: "all", label: "All Stores" },
  { id: "marketplace", label: "Marketplaces" },
  { id: "partner", label: "Partners" },
  { id: "global", label: "Global" },
];

function isGlobalStore(store: Store): boolean {
  return store.supportedRegions.includes("GLOBAL") || store.supportedRegions.length >= 3;
}

export default function StoresPageClient({ stores }: StoresPageClientProps) {
  const t = useTranslations("stores");
  const tCommon = useTranslations("common");
  const [selectedIntegration, setSelectedIntegration] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

  const integrationOptions = useMemo(() => {
    const types = [...new Set(stores.map((store) => store.integrationType))];
    return [
      { value: "", label: "All Integrations" },
      ...types.map((type) => ({ value: type, label: type.charAt(0).toUpperCase() + type.slice(1) })),
    ];
  }, [stores]);

  const sortOptions = [
    { value: "name", label: "Name A-Z" },
    { value: "commission", label: "Highest Commission" },
    { value: "regions", label: "Most Regions" },
  ];

  const stats = useMemo(() => {
    const partnerCount = stores.filter((store) => store.integrationType === "partner").length;
    const regionCount = new Set(stores.flatMap((store) => store.supportedRegions)).size;
    const topCommission = stores.reduce((max, store) => Math.max(max, store.commissionRate), 0);
    return {
      storeCount: stores.length,
      partnerCount,
      regionCount,
      topCommission: Math.round(topCommission),
    };
  }, [stores]);

  const sections = useMemo(() => buildStoreSections(stores), [stores]);

  const filtered = useMemo(() => {
    return [...stores]
      .filter((store) => !selectedIntegration || store.integrationType === selectedIntegration)
      .filter((store) => {
        if (quickFilter === "marketplace") return MARKETPLACE_TYPES.has(store.integrationType);
        if (quickFilter === "partner") return store.integrationType === "partner";
        if (quickFilter === "global") return isGlobalStore(store);
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "commission") return b.commissionRate - a.commissionRate;
        if (sortBy === "regions") return b.supportedRegions.length - a.supportedRegions.length;
        return a.name.localeCompare(b.name);
      });
  }, [stores, selectedIntegration, sortBy, quickFilter]);

  const showCuratedSections =
    quickFilter === "all" && !selectedIntegration && sortBy === "name";

  return (
    <PageLayout>
      <div className="zor-stores-page">
        <StoresPageHero
          title={t("title")}
          subtitle={t("subtitle")}
          storeCount={stats.storeCount}
          partnerCount={stats.partnerCount}
          regionCount={stats.regionCount}
          topCommission={stats.topCommission}
        />

        <div className="zor-stores-page__toolbar">
          <div
            className="zor-stores-page__quick-filters"
            role="tablist"
            aria-label="Quick store filters"
          >
            {QUICK_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={quickFilter === item.id}
                className={`zor-stores-page__quick-filter${
                  quickFilter === item.id ? " is-active" : ""
                }`}
                onClick={() => setQuickFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <PageFilterBar className="zor-stores-page__filters">
            <div className="zor-stores-page__filter-grid">
              <Select
                label="Filter by Integration"
                options={integrationOptions}
                value={selectedIntegration}
                onChange={(e) => setSelectedIntegration(e.target.value)}
              />
              <Select
                label={tCommon("sortBy")}
                options={sortOptions}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              />
              <div className="zor-stores-page__filter-action">
                <Button className="w-full">{t("filter")}</Button>
              </div>
            </div>
          </PageFilterBar>
        </div>

        <div className="zor-stores-page__results-bar">
          <p className="zor-stores-page__results-count">
            {showCuratedSections ? (
              <>
                <strong>{stats.storeCount}</strong> trusted marketplace stores
              </>
            ) : (
              <>
                Showing <strong>{filtered.length}</strong>{" "}
                {filtered.length === 1 ? "store" : "stores"}
              </>
            )}
          </p>
        </div>

        {showCuratedSections ? (
          <div className="zor-stores-page__sections">
            {sections.map((section) => (
              <StoresPageSection
                key={section.id}
                sectionId={section.id}
                stores={section.stores}
                viewProductsLabel={t("viewStoreProducts")}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <PageEmptyState
            title="No stores found"
            description="Try adjusting your filters or check back later for new partner stores."
          />
        ) : (
          <div className="zor-stores-page__grid">
            {filtered.map((store) => (
              <StoresStoreCard
                key={store.id}
                store={store}
                viewProductsLabel={t("viewStoreProducts")}
              />
            ))}
          </div>
        )}
        <PageIdentityCta
          block="zor-stores-page"
          title="Shop smarter across every marketplace"
          description="Compare live prices, unlock coupon codes, and track the best deals from your favorite stores."
        >
          <Link href="/compare"><Button>Compare Prices</Button></Link>
          <Link href="/coupons"><Button variant="outline">Browse Coupons</Button></Link>
        </PageIdentityCta>
      </div>
    </PageLayout>
  );
}
