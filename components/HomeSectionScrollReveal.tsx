"use client";

import { useEffect } from "react";

/** Adds fade-up reveal to homepage product sections while scrolling. */
export default function HomeSectionScrollReveal() {
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>(".home-section-shell");
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return null;
}
