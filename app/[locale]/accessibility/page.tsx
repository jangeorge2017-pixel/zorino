import type { Metadata } from "next";
import { LegalDocumentClient } from "@/components/official";
import { ACCESSIBILITY_CONTENT } from "@/lib/content/official-pages";
import { generateOfficialPageMetadata } from "@/lib/seo/official-page-metadata";

export const metadata: Metadata = generateOfficialPageMetadata("accessibility");

export default function AccessibilityPage() {
  return (
    <LegalDocumentClient
      title="Accessibility Statement"
      subtitle="Our commitment to an inclusive, accessible deal discovery experience."
      content={ACCESSIBILITY_CONTENT}
    />
  );
}
