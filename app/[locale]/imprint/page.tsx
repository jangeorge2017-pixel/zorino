import type { Metadata } from "next";
import { LegalDocumentClient } from "@/components/official";
import { IMPRINT_CONTENT } from "@/lib/content/official-pages";
import { generateOfficialPageMetadata } from "@/lib/seo/official-page-metadata";
import type { Locale } from "@/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generateOfficialPageMetadata("imprint", locale as Locale);
}

export default function ImprintPage() {
  return (
    <LegalDocumentClient
      title="Imprint"
      subtitle="Publisher and operator information for ZORINO."
      content={IMPRINT_CONTENT}
    />
  );
}
