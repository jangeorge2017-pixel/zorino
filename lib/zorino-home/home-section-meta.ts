import {
  Heart,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ZhHomeProductSection } from "@/lib/zorino-home/sections";

export type ZhHomeSectionMeta = {
  subtitle: string;
  sectionClass: "trending" | "flash" | "best" | "recent";
  icon: LucideIcon;
};

export const ZH_HOME_SECTION_META: Record<
  ZhHomeProductSection["key"],
  ZhHomeSectionMeta
> = {
  flash: {
    subtitle: "Limited-time offers ending soon — grab them before they expire",
    sectionClass: "flash",
    icon: Zap,
  },
  priceDrops: {
    subtitle: "Biggest recent price cuts across every store on Zorino",
    sectionClass: "trending",
    icon: TrendingDown,
  },
  newArrivals: {
    subtitle: "Fresh products just landed in the marketplace",
    sectionClass: "recent",
    icon: Sparkles,
  },
  topRated: {
    subtitle: "Highest-rated picks shoppers love right now",
    sectionClass: "best",
    icon: Star,
  },
  editorsPicks: {
    subtitle: "Hand-picked favorites from the Zorino editorial team",
    sectionClass: "trending",
    icon: Heart,
  },
};

export const ZH_TRENDING_DEALS_META = {
  subtitle: "Most popular picks shoppers are saving on right now",
  sectionClass: "trending" as const,
  icon: TrendingUp,
};
