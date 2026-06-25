import CouponsPageClient from "@/components/CouponsPageClient";
import { getCouponsForPage } from "@/lib/data/homepage";

export const dynamic = "force-dynamic";

export default async function CouponsPage() {
  const coupons = await getCouponsForPage();
  return <CouponsPageClient coupons={coupons} />;
}
