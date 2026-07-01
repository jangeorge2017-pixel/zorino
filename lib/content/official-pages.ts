import type { LucideIcon } from "lucide-react";
import {
  Accessibility,
  AlertTriangle,
  Ban,
  Cookie,
  Copyright,
  Database,
  Eye,
  FileText,
  Gavel,
  Globe,
  HandCoins,
  Link2,
  Lock,
  Scale,
  Settings,
  Shield,
  User,
} from "lucide-react";
import { getContactEmail } from "@/lib/site-url";

export const OFFICIAL_LAST_UPDATED = "June 21, 2026";

export type LegalSection = {
  icon: LucideIcon;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type LegalPageContent = {
  intro: string;
  sections: LegalSection[];
  footerNote?: string;
  contactEmail?: string;
  contactHeading?: string;
};

export const PRIVACY_CONTENT: LegalPageContent = {
  intro:
    "At ZORINO, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform. By using ZORINO, you agree to the practices described in this policy.",
  sections: [
    {
      icon: Eye,
      title: "Information We Collect",
      paragraphs: ["We collect information you provide directly to us and data collected automatically through our services."],
      bullets: [
        "Account information (name, email, password)",
        "Profile preferences and notification settings",
        "Search history, wishlists, and saved items",
        "Device, browser, and usage analytics",
        "Affiliate click and conversion metadata",
      ],
    },
    {
      icon: Database,
      title: "How We Use Your Information",
      paragraphs: ["We use collected information to operate, personalize, and improve ZORINO."],
      bullets: [
        "Deliver deal discovery, price comparison, and alerts",
        "Personalize recommendations and search results",
        "Send transactional and marketing communications (with consent)",
        "Measure performance and prevent fraud",
        "Comply with legal obligations",
      ],
    },
    {
      icon: Globe,
      title: "Information Sharing",
      paragraphs: [
        "We do not sell your personal information. We may share limited data with trusted partners under strict agreements.",
      ],
      bullets: [
        "Affiliate and retail partners for attribution (with consent where required)",
        "Infrastructure, analytics, and security service providers",
        "Law enforcement when legally required",
        "Successors in the event of a merger or acquisition",
      ],
    },
    {
      icon: Lock,
      title: "Data Security",
      paragraphs: ["We implement industry-standard safeguards designed to protect your data."],
      bullets: [
        "Encryption in transit and at rest",
        "Role-based access controls and audit logging",
        "Regular security reviews and vulnerability management",
        "Incident response and breach notification procedures",
      ],
    },
    {
      icon: User,
      title: "Your Rights",
      paragraphs: ["Depending on your region, you may have rights to access, correct, delete, or export your data."],
      bullets: [
        "Access and portability of personal data",
        "Correction of inaccurate information",
        "Deletion of your account and associated data",
        "Opt-out of marketing communications",
        "Object to certain processing activities",
      ],
    },
    {
      icon: Cookie,
      title: "Cookies & Tracking",
      paragraphs: [
        "We use cookies and similar technologies for essential functionality, analytics, and affiliate attribution. See our Cookie Policy for details.",
      ],
    },
  ],
  contactEmail: getContactEmail("privacy"),
  contactHeading: "Privacy Inquiries",
};

export const TERMS_CONTENT: LegalPageContent = {
  intro:
    "These Terms of Service govern your access to and use of the ZORINO platform. Please read them carefully. By using ZORINO, you agree to be bound by these terms.",
  sections: [
    {
      icon: FileText,
      title: "Introduction",
      paragraphs: [
        "ZORINO is a deal discovery and price comparison platform. We aggregate offers from partner retailers and may earn affiliate commissions when you purchase through our links.",
        "We do not sell products directly. All transactions occur on third-party retailer websites.",
      ],
    },
    {
      icon: AlertTriangle,
      title: "User Obligations",
      paragraphs: ["By using ZORINO, you agree to:"],
      bullets: [
        "Provide accurate account information",
        "Maintain the confidentiality of your credentials",
        "Use the platform for lawful, personal purposes",
        "Not scrape, reverse engineer, or abuse our systems",
        "Respect intellectual property and community guidelines",
      ],
    },
    {
      icon: Scale,
      title: "Intellectual Property",
      paragraphs: [
        "All ZORINO branding, software, design, and content are protected by applicable intellectual property laws. You may not copy, modify, or redistribute our materials without written permission.",
      ],
    },
    {
      icon: Ban,
      title: "Prohibited Activities",
      paragraphs: ["You may not:"],
      bullets: [
        "Use bots or automated tools to harvest data",
        "Manipulate affiliate tracking or post fraudulent reviews",
        "Upload malware or attempt unauthorized access",
        "Impersonate others or create fraudulent accounts",
        "Violate applicable laws or third-party rights",
      ],
    },
    {
      icon: Gavel,
      title: "Limitation of Liability",
      paragraphs: [
        "ZORINO is provided \"as is.\" We do not guarantee the accuracy of prices, availability, or retailer listings. To the fullest extent permitted by law, ZORINO is not liable for indirect, incidental, or consequential damages arising from your use of the platform.",
      ],
    },
    {
      icon: Settings,
      title: "Changes & Termination",
      paragraphs: [
        "We may update these terms at any time. Continued use constitutes acceptance. We may suspend or terminate accounts that violate these terms.",
      ],
    },
  ],
  footerNote: "These Terms are governed by the laws of the United Arab Emirates. Disputes shall be subject to the exclusive jurisdiction of the courts of Dubai, UAE.",
  contactEmail: getContactEmail("legal"),
  contactHeading: "Legal Inquiries",
};

export const COOKIES_CONTENT: LegalPageContent = {
  intro:
    "This Cookie Policy explains how ZORINO uses cookies and similar technologies when you visit our website or use our applications.",
  sections: [
    {
      icon: Cookie,
      title: "What Are Cookies?",
      paragraphs: [
        "Cookies are small text files stored on your device. They help websites remember preferences, keep you signed in, and understand how visitors use the site.",
      ],
    },
    {
      icon: Settings,
      title: "Types of Cookies We Use",
      paragraphs: ["ZORINO uses the following categories of cookies:"],
      bullets: [
        "Essential — required for login, security, and core functionality",
        "Analytics — help us understand traffic patterns and improve features",
        "Preference — remember language, currency, and display settings",
        "Affiliate — attribute purchases to partner retailers when you click outbound links",
      ],
    },
    {
      icon: Eye,
      title: "Third-Party Cookies",
      paragraphs: [
        "Partner retailers, analytics providers, and advertising networks may set their own cookies when you interact with embedded content or follow outbound links. Their use is governed by their respective policies.",
      ],
    },
    {
      icon: Shield,
      title: "Managing Cookies",
      paragraphs: [
        "You can control cookies through your browser settings. Disabling essential cookies may limit platform functionality. Most browsers allow you to block third-party cookies while keeping essential cookies enabled.",
      ],
    },
    {
      icon: Globe,
      title: "Do Not Track",
      paragraphs: [
        "Some browsers offer a \"Do Not Track\" signal. Because there is no industry standard for DNT, ZORINO currently responds based on applicable privacy laws and your cookie preferences.",
      ],
    },
  ],
  contactEmail: getContactEmail("privacy"),
  contactHeading: "Cookie Questions",
};

export const AFFILIATE_CONTENT: LegalPageContent = {
  intro:
    "ZORINO participates in affiliate programs with partner retailers. This disclosure explains how affiliate relationships work and how they may affect your experience on our platform.",
  sections: [
    {
      icon: HandCoins,
      title: "How We Earn Commissions",
      paragraphs: [
        "When you click a deal or product link on ZORINO and complete a purchase on a partner retailer's website, we may earn a commission at no additional cost to you. The price you pay is determined by the retailer, not by ZORINO.",
      ],
    },
    {
      icon: Link2,
      title: "Affiliate Links",
      paragraphs: [
        "Outbound links to Amazon, eBay, AliExpress, Walmart, Noon, and other partners may contain tracking parameters that identify ZORINO as the referral source. These links help us maintain a free platform for shoppers.",
      ],
    },
    {
      icon: Scale,
      title: "Editorial Independence",
      paragraphs: [
        "Affiliate relationships do not influence our deal rankings, price comparisons, or editorial content. Our goal is to surface the best available offers based on price, availability, and user value — not commission rates.",
      ],
    },
    {
      icon: Eye,
      title: "Transparency",
      paragraphs: [
        "We clearly label sponsored placements where applicable. This page satisfies FTC and international disclosure requirements for affiliate marketing.",
      ],
    },
    {
      icon: Shield,
      title: "Your Choice",
      paragraphs: [
        "You are never required to use affiliate links. You may visit retailers directly, though doing so may prevent ZORINO from earning a commission that supports our free services.",
      ],
    },
  ],
  contactEmail: getContactEmail("partnerships"),
  contactHeading: "Partnership Inquiries",
};

export const DMCA_CONTENT: LegalPageContent = {
  intro:
    "ZORINO respects intellectual property rights and responds to valid Digital Millennium Copyright Act (DMCA) notices. This policy describes our process for reporting and addressing copyright infringement.",
  sections: [
    {
      icon: Copyright,
      title: "Reporting Infringement",
      paragraphs: [
        "If you believe content on ZORINO infringes your copyright, please send a written DMCA notice to our designated agent with the information listed below.",
      ],
      bullets: [
        "Identification of the copyrighted work claimed to be infringed",
        "Identification of the infringing material and its location on ZORINO",
        "Your contact information (name, address, phone, email)",
        "A statement of good-faith belief that use is not authorized",
        "A statement, under penalty of perjury, that the information is accurate",
        "Your physical or electronic signature",
      ],
    },
    {
      icon: Gavel,
      title: "Counter-Notification",
      paragraphs: [
        "If you believe content was removed in error, you may submit a counter-notification including your contact details, identification of removed material, a statement under penalty of perjury, and consent to jurisdiction.",
      ],
    },
    {
      icon: AlertTriangle,
      title: "Repeat Infringers",
      paragraphs: [
        "ZORINO may terminate accounts of users who are repeat infringers in appropriate circumstances.",
      ],
    },
    {
      icon: Shield,
      title: "Product Listings",
      paragraphs: [
        "ZORINO aggregates product information from third-party retailers. For product-specific copyright concerns, you may also contact the listing retailer directly.",
      ],
    },
  ],
  contactEmail: getContactEmail("legal"),
  contactHeading: "DMCA Agent",
  footerNote: "Designated DMCA Agent: ZORINO Legal Team, 123 Tech Street, Dubai, UAE",
};

export const ACCESSIBILITY_CONTENT: LegalPageContent = {
  intro:
    "ZORINO is committed to making deal discovery accessible to everyone. We continually improve our platform to meet Web Content Accessibility Guidelines (WCAG) 2.1 Level AA where practicable.",
  sections: [
    {
      icon: Accessibility,
      title: "Our Commitment",
      paragraphs: [
        "We believe shopping tools should be usable by people of all abilities. Our design system prioritizes readable contrast, keyboard navigation, semantic HTML, and screen-reader compatibility.",
      ],
    },
    {
      icon: Eye,
      title: "Accessibility Features",
      paragraphs: ["ZORINO includes the following accessibility measures:"],
      bullets: [
        "High-contrast dark theme with adjustable typography",
        "Keyboard-navigable menus, filters, and interactive controls",
        "ARIA labels on icons, buttons, and form fields",
        "Responsive layouts for mobile, tablet, and desktop",
        "Reduced-motion support where animations are decorative",
      ],
    },
    {
      icon: Settings,
      title: "Ongoing Improvements",
      paragraphs: [
        "We regularly audit new features for accessibility before release and remediate issues identified through automated testing and user feedback.",
      ],
    },
    {
      icon: Globe,
      title: "Third-Party Content",
      paragraphs: [
        "Outbound links lead to retailer websites that maintain their own accessibility standards. We encourage partners to meet WCAG guidelines but cannot guarantee third-party compliance.",
      ],
    },
    {
      icon: User,
      title: "Feedback & Assistance",
      paragraphs: [
        "If you encounter accessibility barriers on ZORINO, please contact us. We will work with you to provide the information or functionality you need through an alternative method.",
      ],
    },
  ],
  contactEmail: getContactEmail("support"),
  contactHeading: "Accessibility Support",
};
