import FooterStats from "@/components/FooterStats";
import { getHomepageStats } from "@/lib/data/homepage";

export default async function FooterStatsContainer() {
  const { footer } = await getHomepageStats();
  return <FooterStats stats={footer} />;
}
