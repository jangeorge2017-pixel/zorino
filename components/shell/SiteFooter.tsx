import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/faq", label: "FAQ" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
] as const;

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="zor-site-footer">
      <div className="zor-site-footer__inner">
        <span className="zor-site-footer__brand">ZORINO</span>
        <nav className="zor-site-footer__links" aria-label="Footer">
          {FOOTER_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="zor-site-footer__link">
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="zor-site-footer__copy">
          © {year} ZORINO. AI-powered deal discovery.
        </p>
      </div>
    </footer>
  );
}
