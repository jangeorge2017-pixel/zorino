"use client";

import { useCallback, useEffect, useState } from "react";
import { HOME_QUICK_NAV_ITEMS } from "@/lib/homepage/sections";

const SECTION_HIGHLIGHT_CLASS = "is-quick-nav-highlight";
const HIGHLIGHT_DURATION_MS = 1400;

function useMobileNavLabels() {
  const [isMobileNav, setIsMobileNav] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobileNav(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isMobileNav;
}

export default function HomeQuickNav() {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const isMobileNav = useMobileNavLabels();

  useEffect(() => {
    const sections = HOME_QUICK_NAV_ITEMS.map((item) =>
      document.getElementById(item.sectionId),
    ).filter((node): node is HTMLElement => node !== null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]?.target.id) {
          setActiveSectionId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-18% 0px -52% 0px",
        threshold: [0.12, 0.28, 0.45],
      },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const scrollToSection = useCallback((sectionId: string) => {
    const target = document.getElementById(sectionId);
    if (!target) return;

    setActiveSectionId(sectionId);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.classList.add(SECTION_HIGHLIGHT_CLASS);
    window.setTimeout(
      () => target.classList.remove(SECTION_HIGHLIGHT_CLASS),
      HIGHLIGHT_DURATION_MS,
    );
  }, []);

  return (
    <nav className="home-quick-nav" aria-label="Quick section navigation">
      <div className="home-quick-nav-track">
        <div className="home-quick-nav-row">
          {HOME_QUICK_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSectionId === item.sectionId;
            const label = isMobileNav ? item.navTitleMobile : item.navTitle;

            return (
              <button
                key={item.sectionId}
                type="button"
                aria-current={isActive ? "true" : undefined}
                className={`home-quick-nav-item home-quick-nav-item--${item.variant}${
                  isActive ? " is-active" : ""
                }`}
                onClick={() => scrollToSection(item.sectionId)}
              >
                <span className="home-quick-nav-icon" aria-hidden="true">
                  <Icon size={29} strokeWidth={2.25} />
                </span>
                <span className="home-quick-nav-title">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
