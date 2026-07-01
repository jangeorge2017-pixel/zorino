import CouponsPageClient from "@/components/CouponsPageClient";
import { getMockCouponsForPage } from "@/lib/mock/page-data";

export default function CouponsPage() {
  const coupons = getMockCouponsForPage();
  return <CouponsPageClient coupons={coupons} />;
}
