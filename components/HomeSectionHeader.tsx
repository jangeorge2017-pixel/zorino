import Link from "next/link";
import { ChevronRight } from "lucide-react";
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
};

export default function HomeSectionHeader({
  variant,
  title,
  subtitle,
  headingId,
  link,
  meta,
}: HomeSectionHeaderProps) {
  const config = HOME_SECTIONS[variant];
  const Icon = config.icon;

  return (
    <div className="home-section-header">
      <div className="home-section-header-main">
        <span className={`home-section-badge home-section-badge--${variant}`}>
          {config.badge}
        </span>
        <h2
          id={headingId}
          className={`home-section-title home-section-title--${variant}`}
        >
          <span className={`home-section-icon-wrap home-section-icon-wrap--${variant}`}>
            <Icon size={22} aria-hidden="true" />
          </span>
          {title}
        </h2>
        {subtitle ? (
          <p className={`home-section-subtitle home-section-subtitle--${variant}`}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {(link || meta) && (
        <div className="home-section-header-aside">
          {meta}
          {link ? (
            <Link href={link.href} className={`home-section-link home-section-link--${variant}`}>
              {link.label}
              <ChevronRight size={16} />
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
