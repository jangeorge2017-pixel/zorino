import DealsManager from "@/components/admin/DealsManager";
import { adminListDeals, adminListProducts, adminListStores } from "@/lib/admin/actions";

export default async function AdminDealsPage() {
  const [deals, products, stores] = await Promise.all([
    adminListDeals(),
    adminListProducts(),
    adminListStores(),
  ]);

  return <DealsManager initialDeals={deals} products={products} stores={stores} />;
}
