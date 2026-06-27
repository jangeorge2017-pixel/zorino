import HomeProductCard from "@/components/HomeProductCard";
import ReferenceSectionHeader from "@/components/ReferenceSectionHeader";
import DealsCarousel from "@/components/DealsCarousel";
import { HOME_SECTIONS } from "@/lib/homepage/sections";
import { getTrendingDeals } from "@/lib/data/homepage";
import { getProductBadgesMap } from "@/services/trending/queries";
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
      trendingBadge={deal.badge}
      dynamicBadge="price-dropped"
      updatedLabel={`Updated ${deal.updatedMins} min ago`}
      sparklineId={deal.id}
      compareOnly
      hideQuickActions
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

  return (
    <section
      id={HOME_SECTIONS["trending-deals"].sectionId}
      className="home-section-shell home-section-shell--trending-deals trending-section ref-panel"
    >
      <ReferenceSectionHeader
        headingId="trending-deals-heading"
        title="Trending Deals"
        linkHref="/deals"
        linkLabel="View all deals"
      />

      <DealsCarousel>
        {dealsWithBadges.map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
      </DealsCarousel>
    </section>
  );
}
