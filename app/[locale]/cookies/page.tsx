import type { Metadata } from "next";
import { LegalDocumentClient } from "@/components/official";
import { COOKIES_CONTENT } from "@/lib/content/official-pages";
import { generateOfficialPageMetadata } from "@/lib/seo/official-page-metadata";

export const metadata: Metadata = generateOfficialPageMetadata("cookies");

export default function CookiePolicyPage() {
  return (
    <LegalDocumentClient
      title="Cookie Policy"
      subtitle="How ZORINO uses cookies and similar tracking technologies."
      content={COOKIES_CONTENT}
    />
  );
}
