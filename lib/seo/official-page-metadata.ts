import { generateMetadata } from "@/lib/seo/metadata";

const OFFICIAL_PAGE_SEO = {
  about: {
    title: "About Us",
    description:
      "Learn about ZORINO — the AI-powered deal discovery platform helping millions of shoppers compare prices, find coupons, and save money worldwide.",
    keywords: ["about zorino", "deal discovery", "price comparison", "smart shopping"],
  },
  contact: {
    title: "Contact Us",
    description:
      "Get in touch with the ZORINO team for support, partnerships, press inquiries, and general questions. We're here to help.",
    keywords: ["contact zorino", "customer support", "help", "partnerships"],
  },
  privacy: {
    title: "Privacy Policy",
    description:
      "Read how ZORINO collects, uses, and protects your personal data. Your privacy and security are our top priorities.",
    keywords: ["privacy policy", "data protection", "GDPR", "personal information"],
  },
  terms: {
    title: "Terms of Service",
    description:
      "ZORINO Terms of Service — the rules and guidelines for using our deal discovery and price comparison platform.",
    keywords: ["terms of service", "terms and conditions", "user agreement"],
  },
  cookies: {
    title: "Cookie Policy",
    description:
      "Understand how ZORINO uses cookies and similar technologies to improve your experience, analytics, and affiliate tracking.",
    keywords: ["cookie policy", "cookies", "tracking", "browser settings"],
  },
  faq: {
    title: "FAQ",
    description:
      "Frequently asked questions about ZORINO — accounts, deals, coupons, price alerts, shipping, payments, and more.",
    keywords: ["faq", "help center", "questions", "zorino support"],
  },
  affiliate: {
    title: "Affiliate Disclosure",
    description:
      "ZORINO affiliate disclosure — how we earn commissions from partner stores and how it affects the prices you pay.",
    keywords: ["affiliate disclosure", "FTC disclosure", "affiliate links", "commissions"],
  },
  dmca: {
    title: "DMCA Policy",
    description:
      "ZORINO DMCA copyright policy — how to report copyright infringement and our process for handling takedown notices.",
    keywords: ["dmca", "copyright policy", "takedown notice", "intellectual property"],
  },
  accessibility: {
    title: "Accessibility Statement",
    description:
      "ZORINO accessibility commitment — our efforts to make deal discovery accessible to all users, including WCAG guidelines.",
    keywords: ["accessibility", "WCAG", "inclusive design", "assistive technology"],
  },
} as const;

export type OfficialPageSlug = keyof typeof OFFICIAL_PAGE_SEO;

export function generateOfficialPageMetadata(slug: OfficialPageSlug) {
  const config = OFFICIAL_PAGE_SEO[slug];
  const pathMap: Record<OfficialPageSlug, string> = {
    about: "/about",
    contact: "/contact",
    privacy: "/privacy",
    terms: "/terms",
    cookies: "/cookies",
    faq: "/faq",
    affiliate: "/affiliate-disclosure",
    dmca: "/dmca",
    accessibility: "/accessibility",
  };
  return generateMetadata({
    title: config.title,
    description: config.description,
    keywords: [...config.keywords],
    url: pathMap[slug],
  });
}

export function getOfficialPageSeo(slug: OfficialPageSlug) {
  return OFFICIAL_PAGE_SEO[slug];
}
