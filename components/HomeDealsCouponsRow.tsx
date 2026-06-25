import ProductCard from "@/components/productcard";
import CouponSectionContainer from "@/components/CouponSectionContainer";
import { getTopCoupons, getTrendingDeals } from "@/lib/data/homepage";

export default async function HomeDealsCouponsRow() {
  const [deals, coupons] = await Promise.all([getTrendingDeals(), getTopCoupons()]);
  if (deals.length === 0 && coupons.length === 0) return null;

  return (
    <div className="deals-coupons-row">
      <ProductCard />
      <CouponSectionContainer />
    </div>
  );
}
