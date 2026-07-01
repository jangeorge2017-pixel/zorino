import type { Metadata } from "next";
import { LegalDocumentClient } from "@/components/official";
import { TERMS_CONTENT } from "@/lib/content/official-pages";
import { generateOfficialPageMetadata } from "@/lib/seo/official-page-metadata";
import type { Locale } from "@/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generateOfficialPageMetadata("terms", locale as Locale);
}

export default function TermsPage() {
  return (
    <LegalDocumentClient
      title="Terms of Service"
      subtitle="Rules and guidelines for using the ZORINO platform."
      content={TERMS_CONTENT}
    />
  );
}
