import CouponSection from "@/components/CouponSection";
import { getTopCoupons } from "@/lib/data/homepage";

export default async function CouponSectionContainer() {
  const coupons = await getTopCoupons();
  return <CouponSection coupons={coupons} />;
}
