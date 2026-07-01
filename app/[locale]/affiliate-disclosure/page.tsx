import type { Metadata } from "next";
import { LegalDocumentClient } from "@/components/official";
import { AFFILIATE_CONTENT } from "@/lib/content/official-pages";
import { generateOfficialPageMetadata } from "@/lib/seo/official-page-metadata";
import type { Locale } from "@/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generateOfficialPageMetadata("affiliate", locale as Locale);
}

export default function AffiliateDisclosurePage() {
  return (
    <LegalDocumentClient
      title="Affiliate Disclosure"
      subtitle="Transparency about how ZORINO earns commissions from partner retailers."
      content={AFFILIATE_CONTENT}
    />
  );
}
