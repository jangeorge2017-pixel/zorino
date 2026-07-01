import type { Metadata } from "next";
import { LegalDocumentClient } from "@/components/official";
import { COOKIES_CONTENT } from "@/lib/content/official-pages";
import { generateOfficialPageMetadata } from "@/lib/seo/official-page-metadata";
import type { Locale } from "@/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generateOfficialPageMetadata("cookies", locale as Locale);
}

export default function CookiePolicyPage() {
  return (
    <LegalDocumentClient
      title="Cookie Policy"
      subtitle="How ZORINO uses cookies and similar tracking technologies."
      content={COOKIES_CONTENT}
    />
  );
}
