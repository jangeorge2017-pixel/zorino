import CouponsManager from "@/components/admin/CouponsManager";
import { adminListCoupons, adminListStores } from "@/lib/admin/actions";

export default async function AdminCouponsPage() {
  const [coupons, stores] = await Promise.all([adminListCoupons(), adminListStores()]);
  return <CouponsManager initialCoupons={coupons} stores={stores} />;
}
