import type { ReactNode } from "react";
import { Calendar } from "lucide-react";
import { OFFICIAL_LAST_UPDATED } from "@/lib/content/official-pages";

type OfficialPageHeroProps = {
  title: string;
  subtitle: string;
  badge?: string;
  centered?: boolean;
  lastUpdated?: boolean;
};

export default function OfficialPageHero({
  title,
  subtitle,
  badge,
  centered = false,
  lastUpdated = false,
}: OfficialPageHeroProps) {
  return (
    <header className={`zor-official-hero${centered ? " zor-official-hero--center" : ""}`}>
      <div className="zor-official-hero__inner">
        {badge ? <span className="zor-official-hero__badge">{badge}</span> : null}
        <h1 className="zor-official-hero__title">{title}</h1>
        <p className="zor-official-hero__subtitle">{subtitle}</p>
        {lastUpdated ? (
          <p className="flex items-center gap-2 mt-4 text-sm text-[var(--zor-text-muted)]">
            <Calendar size={14} aria-hidden />
            Last updated: {OFFICIAL_LAST_UPDATED}
          </p>
        ) : null}
      </div>
    </header>
  );
}
