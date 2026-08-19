import ZorinoHomePage from "@/components/zorino-home/ZorinoHomePage";
import { generateMetadata as buildSeoMetadata } from "@/lib/seo/metadata";

/** Allow CDN/edge caching between live catalog revalidations. */
export const revalidate = 300;
/** Vercel function timeout — Admitad feed fetch can take up to 25s. */
export const maxDuration = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return buildSeoMetadata({
    title: "Find the Best Deals Across All Marketplaces",
    locale: locale as "en" | "ar",
    pathname: "/",
  });
}

export default function Home() {
  return <ZorinoHomePage />;
}
