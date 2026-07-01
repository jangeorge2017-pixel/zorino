import type { Metadata } from "next";
import { LegalDocumentClient } from "@/components/official";
import { PRIVACY_CONTENT } from "@/lib/content/official-pages";
import { generateOfficialPageMetadata } from "@/lib/seo/official-page-metadata";
import type { Locale } from "@/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generateOfficialPageMetadata("privacy", locale as Locale);
}

export default function PrivacyPage() {
  return (
    <LegalDocumentClient
      title="Privacy Policy"
      subtitle="How we collect, use, and protect your personal information."
      content={PRIVACY_CONTENT}
    />
  );
}
