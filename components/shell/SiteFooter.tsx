import { Link } from "@/i18n/navigation";

const FOOTER_SECTIONS = [
  {
    title: "Company",
    links: [
      { href: "/about", label: "About Us" },
      { href: "/contact", label: "Contact" },
      { href: "/faq", label: "FAQ" },
      { href: "/blog", label: "Blog" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/cookies", label: "Cookies" },
      { href: "/affiliate-disclosure", label: "Affiliate" },
      { href: "/dmca", label: "DMCA" },
      { href: "/accessibility", label: "Accessibility" },
    ],
  },
] as const;

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="zor-site-footer">
      <div className="zor-site-footer__inner zor-site-footer__inner--grid">
        <div className="zor-site-footer__brand-block">
          <span className="zor-site-footer__brand">ZORINO</span>
          <p className="zor-site-footer__tagline">AI-powered deal discovery</p>
        </div>

        {FOOTER_SECTIONS.map((section) => (
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
          © {year} ZORINO. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
