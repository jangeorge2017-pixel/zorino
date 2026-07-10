"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function SiteFooter() {
  const t = useTranslations("footer");
  const year = new Date().getFullYear();

  const sections = [
    {
      title: t("company"),
      links: [
        { href: "/about", label: t("aboutUs") },
        { href: "/contact", label: t("contact") },
        { href: "/faq", label: t("faq") },
        { href: "/blog", label: t("blog") },
      ],
    },
    {
      title: t("legal"),
      links: [
        { href: "/privacy", label: t("privacy") },
        { href: "/terms", label: t("terms") },
        { href: "/cookies", label: t("cookies") },
        { href: "/affiliate-disclosure", label: t("affiliate") },
        { href: "/dmca", label: t("dmca") },
        { href: "/accessibility", label: t("accessibility") },
      ],
    },
  ] as const;

  return (
    <footer className="zor-site-footer">
      <div className="zor-site-footer__inner zor-site-footer__inner--grid">
        <div className="zor-site-footer__brand-block">
          <span className="zor-site-footer__brand">ZORINO</span>
          <p className="zor-site-footer__tagline">{t("tagline")}</p>
        </div>

        {sections.map((section) => (
          <nav key={section.title} className="zor-site-footer__col" aria-label={section.title}>
            <h3 className="zor-site-footer__col-title">{section.title}</h3>
            <ul className="zor-site-footer__col-links">
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="zor-site-footer__link">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <p className="zor-site-footer__copy zor-site-footer__copy--full">
          {t("rights", { year })}
        </p>
      </div>
    </footer>
  );
}
