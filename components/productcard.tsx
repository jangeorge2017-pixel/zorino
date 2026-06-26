import HomeProductCard from "@/components/HomeProductCard";
import HomeSectionHeader from "@/components/HomeSectionHeader";
import { HOME_SECTIONS } from "@/lib/homepage/sections";
import TrendingBadgePill from "@/components/TrendingBadge";
import { getTrendingDeals } from "@/lib/data/homepage";
import { getProductBadgesMap } from "@/services/trending/queries";
import { formatCompactCount } from "@/lib/homepage/format";
import type { TrendingDealCard } from "@/lib/types/entities";

function DealCard({ deal }: { deal: TrendingDealCard }) {
  return (
    <HomeProductCard
      variant="trending-deals"
      productId={String(deal.productId ?? deal.id)}
      name={deal.name}
      imageSrc={deal.imageSrc}
      emoji={deal.emoji}
      price={deal.price}
      originalPrice={deal.originalPrice}
      discount={deal.discount}
      rating={deal.rating}
      reviewCount={deal.reviews}
      storeName={deal.store}
      storeLogoSrc={deal.storeLogoSrc}
      storeInitial={deal.storeInitial}
      storesCompared={deal.providerCount}
      shippingTime="Limited time"
      priceHistory={deal.priceHistory}
      showPriceDrop
      updatedLabel={`Updated ${deal.updatedMins} min ago`}
      sparklineId={deal.id}
      badges={
        <>
          {deal.badge ? <TrendingBadgePill badge={deal.badge} size="sm" /> : null}
          <span className="home-product-flash-badge">Flash Deal</span>
        </>
      }
    />
  );
}

export default async function ProductCard() {
  const deals = await getTrendingDeals();
  const productIds = deals.map((d) => String(d.productId ?? d.id));
  const badges = await getProductBadgesMap(productIds);
  const dealsWithBadges = deals.map((deal) => ({
    ...deal,
    badge: badges.get(String(deal.productId ?? deal.id)) ?? deal.badge ?? null,
  }));

  if (deals.length === 0) {
    return null;
  }

  const priceDropped = dealsWithBadges.filter((deal) => deal.discount >= 20).length;

  return (
    <section
      id={HOME_SECTIONS["trending-deals"].sectionId}
      className="home-section-shell home-section-shell--trending-deals trending-section"
    >
      <HomeSectionHeader
        variant="trending-deals"
        headingId="trending-deals-heading"
        title="Trending Deals"
        subtitle="Price drops and hot offers updated throughout the day"
        link={{ href: "/deals", label: "View all deals" }}
        stats={[
          { value: formatCompactCount(dealsWithBadges.length), label: "Live Deals" },
          { value: String(priceDropped), label: "Price Dropped" },
          { value: "Limited Time", label: "Flash Deals" },
        ]}
        tags={["Price Dropped", "Flash Deals", "Countdown Ready"]}
      />

      <div className="deals-grid">
        {dealsWithBadges.map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
      </div>
    </section>
  );
}
