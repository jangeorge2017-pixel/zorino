import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { generateMetadata as buildSeoMetadata } from "@/lib/seo/metadata";
import "./globals.css";
import "./hero-responsive.css";
import "./homepage-reference.css";

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

export const metadata: Metadata = buildSeoMetadata({
  title: "Find Better Deals Faster",
  description:
    "Compare prices across thousands of stores and discover the best deals in seconds.",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
