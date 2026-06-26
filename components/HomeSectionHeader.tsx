import Link from "next/link";
import { ChevronRight } from "lucide-react";
import HomeSectionStats, { type HomeSectionStatItem } from "@/components/HomeSectionStats";
import {
  HOME_SECTIONS,
  type HomeSectionVariant,
} from "@/lib/homepage/sections";

type HomeSectionHeaderProps = {
  variant: HomeSectionVariant;
  title: string;
  subtitle?: string;
  headingId: string;
  link?: { href: string; label: string };
  meta?: React.ReactNode;
  stats?: HomeSectionStatItem[];
  tags?: string[];
  animatedIcon?: boolean;
};

export default function HomeSectionHeader({
  variant,
  title,
  subtitle,
  headingId,
  link,
  meta,
  stats,
  tags,
  animatedIcon = false,
}: HomeSectionHeaderProps) {
  const config = HOME_SECTIONS[variant];
  const Icon = config.icon;

  return (
    <header className="home-section-header-block">
      <div className="home-section-header">
        <div className="home-section-header-main">
          <span className={`home-section-badge home-section-badge--${variant}`}>
            {config.badge}
          </span>
          <h2
            id={headingId}
            className={`home-section-title home-section-title--${variant}`}
          >
            <span
              className={`home-section-icon-wrap home-section-icon-wrap--${variant}${
                animatedIcon ? " home-section-icon-wrap--animated" : ""
              }`}
            >
              <Icon size={22} aria-hidden="true" />
            </span>
            {title}
          </h2>
          {subtitle ? (
            <p className={`home-section-subtitle home-section-subtitle--${variant}`}>
              {subtitle}
            </p>
          ) : null}
          <div
            className={`home-section-accent-line home-section-accent-line--${variant}`}
            aria-hidden="true"
          />
        </div>
        {(link || meta) && (
          <div className="home-section-header-aside">
            {meta}
            {link ? (
              <Link
                href={link.href}
                className={`home-section-link home-section-link--${variant}`}
              >
                {link.label}
                <ChevronRight size={16} />
              </Link>
            ) : null}
          </div>
        )}
      </div>

      {tags && tags.length > 0 ? (
        <ul className={`home-section-tags home-section-tags--${variant}`}>
          {tags.map((tag) => (
            <li key={tag} className="home-section-tag">
              {tag}
            </li>
          ))}
        </ul>
      ) : null}

      {stats && stats.length > 0 ? (
        <HomeSectionStats variant={variant} items={stats} />
      ) : null}
    </header>
  );
}
