import type { Metadata } from "next";
import { FAQPageClient } from "@/components/official";
import { generateOfficialPageMetadata } from "@/lib/seo/official-page-metadata";
import type { Locale } from "@/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generateOfficialPageMetadata("faq", locale as Locale);
}

export default function FAQPage() {
  return <FAQPageClient />;
}
