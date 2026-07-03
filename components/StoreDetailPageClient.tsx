"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import ListingProductCard from "@/components/ListingProductCard";
import StoreDetailHero from "@/components/stores/StoreDetailHero";
import PageIdentityCta from "@/components/page-identity/PageIdentityCta";
import { PageFilterBar, PageLayout } from "@/components/pages";
import type { MockStoreDetail } from "@/lib/mock/types";
import "@/components/stores/stores-page.css";

type StoreDetailPageClientProps = {
  detail: MockStoreDetail;
};

export default function StoreDetailPageClient({ detail }: StoreDetailPageClientProps) {
  const { store, products } = detail;
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
      <div className="zor-stores-page">
        <StoreDetailHero detail={detail} />

        <PageFilterBar className="zor-stores-page__filters">
          <div className="zor-stores-page__filter-grid">
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
            <div className="zor-stores-page__filter-action">
              <Link href="/deals" className="w-full block">
                <Button variant="outline" className="w-full">View All Deals</Button>
              </Link>
            </div>
            <div className="zor-stores-page__filter-action">
              <Link href="/coupons" className="w-full block">
                <Button className="w-full">View Coupons</Button>
              </Link>
            </div>
          </div>
        </PageFilterBar>

        <div className="listing-products-grid zor-stores-page__detail-grid">
          {sortedProducts.map((product) => (
            <ListingProductCard key={product.id} product={product} />
          ))}
        </div>

        <PageIdentityCta
          block="zor-stores-page"
          title={`More ways to save at ${store.name}`}
          description="Compare this store against others and stack verified coupon codes at checkout."
        >
          <Link href={`/coupons?store=${store.slug}`}><Button>Store Coupons</Button></Link>
          <Link href="/compare"><Button variant="outline">Compare Prices</Button></Link>
        </PageIdentityCta>
      </div>
    </PageLayout>
  );
}
