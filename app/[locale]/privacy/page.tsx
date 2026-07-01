import type { Metadata } from "next";
import { LegalDocumentClient } from "@/components/official";
import { PRIVACY_CONTENT } from "@/lib/content/official-pages";
import { generateOfficialPageMetadata } from "@/lib/seo/official-page-metadata";

export const metadata: Metadata = generateOfficialPageMetadata("privacy");

export default function PrivacyPage() {
  return (
    <LegalDocumentClient
      title="Privacy Policy"
      subtitle="How we collect, use, and protect your personal information."
      content={PRIVACY_CONTENT}
    />
  );
}
