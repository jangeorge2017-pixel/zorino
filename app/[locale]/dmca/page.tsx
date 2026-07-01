import type { Metadata } from "next";
import { LegalDocumentClient } from "@/components/official";
import { DMCA_CONTENT } from "@/lib/content/official-pages";
import { generateOfficialPageMetadata } from "@/lib/seo/official-page-metadata";

export const metadata: Metadata = generateOfficialPageMetadata("dmca");

export default function DMCAPolicyPage() {
  return (
    <LegalDocumentClient
      title="DMCA Policy"
      subtitle="Copyright infringement reporting and takedown procedures."
      content={DMCA_CONTENT}
    />
  );
}
