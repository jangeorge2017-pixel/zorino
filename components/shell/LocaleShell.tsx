"use client";

import { usePathname } from "next/navigation";
import PublicShell from "@/components/shell/PublicShell";
import StickyChromeClearance from "@/components/shell/StickyChromeClearance";

const LOCALES = ["en", "ar"] as const;

function isHomepage(pathname: string): boolean {
  if (pathname === "/") return true;
  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 1 && LOCALES.includes(segments[0] as (typeof LOCALES)[number]);
}

function isAdminRoute(pathname: string): boolean {
  return pathname === "/admin" || pathname.includes("/admin/");
}

type LocaleShellProps = {
  children: React.ReactNode;
};

/**
 * Applies PublicShell to locale routes except the standalone homepage landing and admin.
 */
export default function LocaleShell({ children }: LocaleShellProps) {
  const pathname = usePathname();

  if (isAdminRoute(pathname)) {
    return <>{children}</>;
  }

  if (isHomepage(pathname)) {
    return (
      <>
        <StickyChromeClearance />
        {children}
      </>
    );
  }

  return (
    <>
      <StickyChromeClearance />
      <PublicShell>{children}</PublicShell>
    </>
  );
}
