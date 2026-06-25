import Hero from "@/components/Hero";
import {
  getHeroFloatingProducts,
  getHomepageStats,
} from "@/lib/data/homepage";

export default async function HeroContainer() {
  const [floatingProducts, { hero: stats }] = await Promise.all([
    getHeroFloatingProducts(),
    getHomepageStats(),
  ]);

  return <Hero floatingProducts={floatingProducts} stats={stats} />;
}
