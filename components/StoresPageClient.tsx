"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import { Star, ExternalLink, CheckCircle } from "lucide-react";
import type { Store } from "@/lib/types/entities";

type StoresPageClientProps = {
  stores: Store[];
};

export default function StoresPageClient({ stores }: StoresPageClientProps) {
  const t = useTranslations("stores");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [sortBy, setSortBy] = useState("name");

  const categories = [
    { value: "", label: "All Categories" },
    { value: "amazon", label: "Amazon" },
    { value: "partner", label: "Partner" },
    { value: "custom", label: "Custom" },
  ];

  const sortOptions = [
    { value: "name", label: "Name A-Z" },
    { value: "integration", label: "Integration Type" },
  ];

  const filtered = [...stores]
    .filter((store) => {
      if (!selectedCategory) return true;
      return store.integrationType === selectedCategory;
    })
    .sort((a, b) => {
      if (sortBy === "integration") {
        return a.integrationType.localeCompare(b.integrationType);
      }
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t("title")}</h1>
          <p className="text-gray-400">{t("subtitle")}</p>
        </div>

        <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Filter by Integration"
              options={categories}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            />
            <Select
              label="Sort By"
              options={sortOptions}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            />
            <div className="flex items-end">
              <Button className="w-full">{t("filter")}</Button>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-gray-400">No stores found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((store) => (
              <Card key={store.id} hover>
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gray-800 flex items-center justify-center">
                        {store.logoUrl ? (
                          <Image
                            src={store.logoUrl}
                            alt={store.name}
                            fill
                            className="object-contain p-1"
                            unoptimized
                          />
                        ) : (
                          <span className="text-lg font-bold text-purple-300">
                            {store.logoInitial ?? store.name.slice(0, 2)}
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                          {store.name}
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        </h3>
                        <p className="text-sm text-gray-400 capitalize">{store.integrationType}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500 fill-current" />
                    <span className="text-white font-semibold">4.5</span>
                    <span className="text-gray-400 text-sm">Partner store</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400">Commission</p>
                      <p className="text-white font-semibold">{store.commissionRate}%</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Regions</p>
                      <p className="text-white font-semibold">{store.supportedRegions.length || "—"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-400 break-all">
                    <ExternalLink className="w-4 h-4 shrink-0" />
                    <span>{store.website}</span>
                  </div>

                  <div className="flex gap-2">
                    <Link href={`/stores/${store.slug}`} className="flex-1">
                      <Button className="w-full">{t("viewStoreProducts")}</Button>
                    </Link>
                    <Link href={store.website} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" className="flex items-center gap-2">
                        <ExternalLink className="w-4 h-4" />
                        Visit
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
