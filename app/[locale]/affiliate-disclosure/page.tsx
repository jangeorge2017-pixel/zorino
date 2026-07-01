import type { Metadata } from "next";
import { LegalDocumentClient } from "@/components/official";
import { AFFILIATE_CONTENT } from "@/lib/content/official-pages";
import { generateOfficialPageMetadata } from "@/lib/seo/official-page-metadata";

export const metadata: Metadata = generateOfficialPageMetadata("affiliate");

export default function AffiliateDisclosurePage() {
  return (
    <LegalDocumentClient
      title="Affiliate Disclosure"
      subtitle="Transparency about how ZORINO earns commissions from partner retailers."
      content={AFFILIATE_CONTENT}
    />
  );
}
