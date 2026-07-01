import type { Metadata } from "next";
import { ContactPageClient } from "@/components/official";
import { generateOfficialPageMetadata } from "@/lib/seo/official-page-metadata";

export const metadata: Metadata = generateOfficialPageMetadata("contact");

export default function ContactPage() {
  return <ContactPageClient />;
}
