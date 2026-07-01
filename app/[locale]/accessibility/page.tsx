import type { Metadata } from "next";
import { LegalDocumentClient } from "@/components/official";
import { ACCESSIBILITY_CONTENT } from "@/lib/content/official-pages";
import { generateOfficialPageMetadata } from "@/lib/seo/official-page-metadata";
import type { Locale } from "@/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generateOfficialPageMetadata("accessibility", locale as Locale);
}

export default function AccessibilityPage() {
  return (
    <LegalDocumentClient
      title="Accessibility Statement"
      subtitle="Our commitment to an inclusive, accessible deal discovery experience."
      content={ACCESSIBILITY_CONTENT}
    />
  );
}
