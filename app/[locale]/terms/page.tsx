import type { Metadata } from "next";
import { LegalDocumentClient } from "@/components/official";
import { TERMS_CONTENT } from "@/lib/content/official-pages";
import { generateOfficialPageMetadata } from "@/lib/seo/official-page-metadata";

export const metadata: Metadata = generateOfficialPageMetadata("terms");

export default function TermsPage() {
  return (
    <LegalDocumentClient
      title="Terms of Service"
      subtitle="Rules and guidelines for using the ZORINO platform."
      content={TERMS_CONTENT}
    />
  );
}
