import type { Metadata } from "next";
import { FAQPageClient } from "@/components/official";
import { generateOfficialPageMetadata } from "@/lib/seo/official-page-metadata";

export const metadata: Metadata = generateOfficialPageMetadata("faq");

export default function FAQPage() {
  return <FAQPageClient />;
}
