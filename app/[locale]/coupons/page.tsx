import CouponsPageClient from "@/components/CouponsPageClient";
import { getCouponsForPage } from "@/lib/data/homepage";
import { generateMetadata as buildSeoMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return buildSeoMetadata({
    title: "Coupons",
    description: "Save money with exclusive discount codes",
    pathname: "/coupons",
    locale: locale === "ar" ? "ar" : "en",
  });
}

export default async function CouponsPage() {
  const coupons = await getCouponsForPage();
  return <CouponsPageClient coupons={coupons} />;
}
