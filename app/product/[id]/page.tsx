import { redirect } from "next/navigation";

type ProductStubProps = {
  params: Promise<{ id: string }>;
};

/** Legacy non-locale route — send traffic to the real localized product page. */
export default async function ProductStubRedirect({ params }: ProductStubProps) {
  const { id } = await params;
  redirect(`/product/${encodeURIComponent(id)}`);
}
