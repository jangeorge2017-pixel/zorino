import type { Metadata } from "next";
import { AboutPageClient } from "@/components/official";
import { generateOfficialPageMetadata } from "@/lib/seo/official-page-metadata";

export const metadata: Metadata = generateOfficialPageMetadata("about");

export default function AboutPage() {
  return <AboutPageClient />;
}
