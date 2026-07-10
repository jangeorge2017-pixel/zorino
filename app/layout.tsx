import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Arabic } from "next/font/google";
import { getLocale } from "next-intl/server";
import { generateMetadata as buildSeoMetadata } from "@/lib/seo/metadata";
import { languages } from "@/lib/international/config";
import type { Locale } from "@/i18n/config";
import "./globals.css";
import "./zorino-fixes.css";
import "./design-system.css";
import "./site-final-polish.css";
import "./badge-amber.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const notoArabic = Noto_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = buildSeoMetadata({
  title: "Find Better Deals Faster",
  description:
    "Compare prices across thousands of stores and discover the best deals in seconds.",
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await getLocale()) as Locale;
  const dir = languages[locale]?.dir ?? "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${notoArabic.variable} h-full antialiased`}
      data-locale={locale}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
