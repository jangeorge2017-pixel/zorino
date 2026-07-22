"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import ZorinoHomeViewAllLink, {
  type ZorinoHomeViewAllVariant,
} from "@/components/zorino-home/ZorinoHomeViewAllLink";
import "./zorino-home-section-header.css";

export type ZorinoHomeSectionHeaderProps = {
  titleId: string;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  iconNode?: ReactNode;
  viewAll?: {
    href: string;
    variant: ZorinoHomeViewAllVariant;
  };
  /** Extra controls beside View All (e.g. Trending sort). */
  actions?: ReactNode;
  /** Row below the title (e.g. Trending filter tabs). */
  children?: ReactNode;
  className?: string;
};

/**
 * Unified homepage section header — identical chrome on desktop / tablet / mobile.
 * Does not change View All, filters, or sort behavior; layout shell only.
 */
export default function ZorinoHomeSectionHeader({
  titleId,
  title,
  subtitle,
  icon: Icon,
  iconNode,
  viewAll,
  actions,
  children,
  className,
}: ZorinoHomeSectionHeaderProps) {
  const iconContent =
    iconNode ??
    (Icon ? <Icon size={18} aria-hidden /> : null);

  return (
    <div
      className={["zh-section-header", "zh-section-head", className]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="zh-section-header__row zor-deals-page__section-head">
        <div className="zh-section-header__title-wrap zor-deals-page__section-title-wrap">
          {iconContent ? (
            <span
              className="zh-section-header__icon zor-deals-page__section-icon"
              aria-hidden
            >
              {iconContent}
            </span>
          ) : null}
          <div className="zh-section-header__copy">
            <h2
              id={titleId}
              className="zh-section-header__title zor-deals-page__section-title zh-section-head__title"
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="zh-section-header__subtitle zor-deals-page__section-subtitle">
                {subtitle}
              </p>
            ) : (
              <p className="zh-section-header__subtitle zh-section-header__subtitle--spacer" aria-hidden>
                &nbsp;
              </p>
            )}
          </div>
        </div>
        {(viewAll || actions) && (
          <div className="zh-section-header__actions">
            {viewAll ? (
              <ZorinoHomeViewAllLink href={viewAll.href} variant={viewAll.variant} />
            ) : null}
            {actions}
          </div>
        )}
      </header>
      {children ? <div className="zh-section-header__controls">{children}</div> : null}
    </div>
  );
}
