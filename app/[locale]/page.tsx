import ZorinoHomePage from "@/components/zorino-home/ZorinoHomePage";

import { generateMetadata as buildSeoMetadata } from "@/lib/seo/metadata";



export const dynamic = "force-dynamic";



export async function generateMetadata({

  params,

}: {

  params: Promise<{ locale: string }>;

}) {

  const { locale } = await params;

  return buildSeoMetadata({

    title: "Find the Best Deals Across All Marketplaces",

    locale,

    alternateLocales: locale === "en" ? ["ar"] : ["en"],

  });

}



export default function Home() {

  return <ZorinoHomePage />;

}


