import ProductsManager from "@/components/admin/ProductsManager";
import { adminListCategories, adminListProducts } from "@/lib/admin/actions";

export default async function AdminProductsPage() {
  const [products, categories] = await Promise.all([
    adminListProducts(),
    adminListCategories(),
  ]);

  return <ProductsManager initialProducts={products} categories={categories} />;
}
