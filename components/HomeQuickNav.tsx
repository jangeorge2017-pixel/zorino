"use client";

import { HOME_QUICK_NAV_ITEMS } from "@/lib/homepage/sections";

export default function HomeQuickNav() {
  const scrollToSection = (sectionId: string) => {
    const target = document.getElementById(sectionId);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav className="home-quick-nav" aria-label="Quick section navigation">
      <div className="home-quick-nav-grid">
        {HOME_QUICK_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.sectionId}
              type="button"
              className={`home-quick-nav-card home-quick-nav-card--${item.variant}`}
              onClick={() => scrollToSection(item.sectionId)}
            >
              <span className={`home-quick-nav-icon home-quick-nav-icon--${item.variant}`}>
                <Icon size={20} aria-hidden="true" />
              </span>
              <span className="home-quick-nav-text">
                <span className="home-quick-nav-title">{item.navTitle}</span>
                <span className="home-quick-nav-subtitle">{item.navSubtitle}</span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
