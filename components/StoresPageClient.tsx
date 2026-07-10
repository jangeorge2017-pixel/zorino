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
import { Link } from "@/i18n/navigation";
import "@/components/stores/stores-page.css";

type StoresPageClientProps = {
  stores: Store[];
};

type QuickFilter = "all" | "marketplace" | "partner" | "global";

const MARKETPLACE_TYPES = new Set(["amazon", "ebay", "aliexpress", "walmart", "noon"]);

function isGlobalStore(store: Store): boolean {
  return store.supportedRegions.includes("GLOBAL") || store.supportedRegions.length >= 3;
}

export default function StoresPageClient({ stores }: StoresPageClientProps) {
  const t = useTranslations("stores");
  const tCommon = useTranslations("common");
  const tProduct = useTranslations("product");
  const [selectedIntegration, setSelectedIntegration] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

  const quickFilters: { id: QuickFilter; label: string }[] = [
    { id: "all", label: t("allStores") },
    { id: "marketplace", label: t("filterMarketplaces") },
    { id: "partner", label: t("filterPartners") },
    { id: "global", label: t("filterGlobal") },
  ];

  const integrationOptions = useMemo(() => {
    const types = [...new Set(stores.map((store) => store.integrationType))];
    return [
      { value: "", label: t("allIntegrations") },
      ...types.map((type) => ({
        value: type,
        label: type.charAt(0).toUpperCase() + type.slice(1),
      })),
    ];
  }, [stores, t]);

  const sortOptions = [
    { value: "name", label: t("sortName") },
    { value: "commission", label: t("sortCommission") },
    { value: "regions", label: t("sortRegions") },
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
            aria-label={t("quickFiltersAria")}
          >
            {quickFilters.map((item) => (
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
                label={t("filterByIntegration")}
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
                <strong>{stats.storeCount}</strong> {t("resultsActiveLabel")}
              </>
            ) : (
              <>
                {t("resultsShowingPrefix")} <strong>{filtered.length}</strong>{" "}
                {filtered.length === 1 ? t("resultsStoreOne") : t("resultsStoreMany")}
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
          <PageEmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
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
          title={t("ctaTitle")}
          description={t("ctaDescription")}
        >
          <Link href="/compare">
            <Button>{tProduct("comparePrices")}</Button>
          </Link>
          <Link href="/coupons">
            <Button variant="outline">{t("ctaBrowseCoupons")}</Button>
          </Link>
        </PageIdentityCta>
      </div>
    </PageLayout>
  );
}
