import StoresManager from "@/components/admin/StoresManager";
import { adminListStores } from "@/lib/admin/actions";

export default async function AdminStoresPage() {
  const stores = await adminListStores();
  return <StoresManager initialStores={stores} />;
}
