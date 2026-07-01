import type { Metadata } from "next";
import { LegalDocumentClient } from "@/components/official";
import { DMCA_CONTENT } from "@/lib/content/official-pages";
import { generateOfficialPageMetadata } from "@/lib/seo/official-page-metadata";
import type { Locale } from "@/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generateOfficialPageMetadata("dmca", locale as Locale);
}

export default function DMCAPolicyPage() {
  return (
    <LegalDocumentClient
      title="DMCA Policy"
      subtitle="Copyright infringement reporting and takedown procedures."
      content={DMCA_CONTENT}
    />
  );
}
