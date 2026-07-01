"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  SITE_NAV_MENUS,
  type NavMenuItem,
  type SiteNavMenuSection,
} from "@/lib/navigation/site-menu";

function NavMenuTree({
  items,
  depth = 0,
  onNavigate,
}: {
  items: NavMenuItem[];
  depth?: number;
  onNavigate: () => void;
}) {
  return (
    <ul className={`zor-mega-menu__list${depth > 0 ? " zor-mega-menu__list--nested" : ""}`} role="list">
      {items.map((item) => (
        <li key={`${item.href}-${item.label}`} className="zor-mega-menu__item">
          <div className="zor-mega-menu__item-row">
            <Link
              href={item.href}
              className="zor-mega-menu__link"
              onClick={onNavigate}
            >
              <span className="zor-mega-menu__link-label">{item.label}</span>
              {item.description ? (
                <span className="zor-mega-menu__link-desc">{item.description}</span>
              ) : null}
            </Link>
            {item.children && item.children.length > 0 ? (
              <ChevronRight size={14} className="zor-mega-menu__nested-chevron" aria-hidden />
            ) : null}
          </div>
          {item.children && item.children.length > 0 ? (
            <div className="zor-mega-menu__flyout">
              <NavMenuTree items={item.children} depth={depth + 1} onNavigate={onNavigate} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function MegaMenuPanel({
  section,
  isOpen,
  onClose,
  panelId,
  triggerId,
}: {
  section: SiteNavMenuSection;
  isOpen: boolean;
  onClose: () => void;
  panelId: string;
  triggerId: string;
}) {
  if (!isOpen) return null;

  return (
    <div
      id={panelId}
      className="zor-mega-menu__panel"
      role="menu"
      aria-labelledby={triggerId}
    >
      <div className="zor-mega-menu__panel-header">
        <div>
          <p className="zor-mega-menu__panel-title">{section.label}</p>
          <p className="zor-mega-menu__panel-desc">{section.description}</p>
        </div>
        <Link href={section.href} className="zor-mega-menu__panel-cta" onClick={onClose}>
          View all
        </Link>
      </div>
      <div className="zor-mega-menu__panel-body">
        <NavMenuTree items={section.children} onNavigate={onClose} />
      </div>
    </div>
  );
}

function MegaMenuTrigger({ section }: { section: SiteNavMenuSection }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerId = useId();
  const panelId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        close();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, close]);

  return (
    <div
      ref={rootRef}
      className={`zor-mega-menu${open ? " zor-mega-menu--open" : ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        id={triggerId}
        className="zor-nav__link zor-mega-menu__trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {section.label}
        <ChevronDown size={14} className="zor-mega-menu__chevron" aria-hidden />
      </button>
      <MegaMenuPanel
        section={section}
        isOpen={open}
        onClose={close}
        panelId={panelId}
        triggerId={triggerId}
      />
    </div>
  );
}

export default function SiteNavMenu() {
  return (
    <>
      {SITE_NAV_MENUS.map((section) => (
        <MegaMenuTrigger key={section.id} section={section} />
      ))}
    </>
  );
}
