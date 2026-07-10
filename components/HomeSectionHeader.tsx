import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";
import {
  HOME_SECTIONS,
  type HomeSectionVariant,
} from "@/lib/homepage/sections";

type HomeSectionHeaderProps = {
  variant: HomeSectionVariant;
  title: string;
  subtitle?: string;
  headingId: string;
  link?: { href: string; label?: string };
  updatedLabel?: string;
  animatedIcon?: boolean;
};

export default function HomeSectionHeader({
  variant,
  title,
  subtitle,
  headingId,
  link,
  updatedLabel,
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
          <div className="home-section-title-row">
            <h2
              id={headingId}
              className={`home-section-title home-section-title--${variant}`}
            >
              <span
                className={`home-section-icon-wrap home-section-icon-wrap--${variant}${
                  animatedIcon ? " home-section-icon-wrap--animated" : ""
                }`}
              >
                <Icon size={26} aria-hidden="true" />
              </span>
              {title}
            </h2>
          </div>
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

        <div className="home-section-header-aside">
          {updatedLabel ? (
            <p className="home-section-updated">{updatedLabel}</p>
          ) : null}
          {link ? (
            <Link
              href={link.href}
              className={`home-section-view-all home-section-view-all--${variant}`}
            >
              {link.label ?? "View All"}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
