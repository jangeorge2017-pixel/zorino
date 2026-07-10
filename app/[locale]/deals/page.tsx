import DealsPageClient from "@/components/DealsPageClient";
import { getDealsForPage } from "@/lib/data/homepage";
import { generateMetadata as buildSeoMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return buildSeoMetadata({
    title: "Deals",
    description: "Discover the best deals from top stores",
    pathname: "/deals",
    locale: locale === "ar" ? "ar" : "en",
  });
}

export default async function DealsPage() {
  const deals = await getDealsForPage();
  return <DealsPageClient deals={deals} />;
}
