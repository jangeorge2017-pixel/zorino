"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import ListingProductCard from "@/components/ListingProductCard";
import { PageFilterBar, PageHeader, PageLayout } from "@/components/pages";
import { CheckCircle, ExternalLink, Star, Tag } from "lucide-react";
import type { MockStoreDetail } from "@/lib/mock/types";

type StoreDetailPageClientProps = {
  detail: MockStoreDetail;
};

export default function StoreDetailPageClient({ detail }: StoreDetailPageClientProps) {
  const { store, description, productCount, avgRating, dealsCount, couponsCount, products } = detail;
  const [sortBy, setSortBy] = useState("discount");

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      if (sortBy === "price_low") return a.price - b.price;
      if (sortBy === "price_high") return b.price - a.price;
      if (sortBy === "rating") return b.rating - a.rating;
      return b.discount - a.discount;
    });
  }, [products, sortBy]);

  return (
    <PageLayout>
      <PageHeader
        title={store.name}
        subtitle={description}
        actions={
          <Link href={store.website} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Visit Store
            </Button>
          </Link>
        }
      />

      <Card className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-gray-800 flex items-center justify-center shrink-0">
            {store.logoUrl ? (
              <Image src={store.logoUrl} alt={store.name} fill className="object-contain p-2" unoptimized />
            ) : (
              <span className="text-2xl font-bold text-purple-300">{store.logoInitial}</span>
            )}
          </div>
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-gray-400 text-sm">Products</p>
              <p className="text-white font-semibold text-lg">{productCount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Rating</p>
              <p className="text-white font-semibold text-lg flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500 fill-current" />
                {avgRating}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Active Deals</p>
              <p className="text-white font-semibold text-lg">{dealsCount}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Coupons</p>
              <p className="text-white font-semibold text-lg flex items-center gap-1">
                <Tag className="w-4 h-4 text-purple-400" />
                {couponsCount}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <CheckCircle className="w-4 h-4" />
            Verified Partner
          </div>
        </div>
      </Card>

      <PageFilterBar>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label="Sort Products"
            options={[
              { value: "discount", label: "Highest Discount" },
              { value: "price_low", label: "Price: Low to High" },
              { value: "price_high", label: "Price: High to Low" },
              { value: "rating", label: "Rating" },
            ]}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          />
          <div className="md:col-span-2 flex items-end gap-3">
            <Link href="/deals" className="flex-1">
              <Button variant="outline" className="w-full">View All Deals</Button>
            </Link>
            <Link href="/coupons" className="flex-1">
              <Button className="w-full">View Coupons</Button>
            </Link>
          </div>
        </div>
      </PageFilterBar>

      <div className="listing-products-grid">
        {sortedProducts.map((product) => (
          <ListingProductCard key={product.id} product={product} />
        ))}
      </div>
    </PageLayout>
  );
}
