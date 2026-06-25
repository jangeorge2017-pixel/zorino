"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Package,
  Store,
  Tag,
  ShoppingBag,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { adminSignOut } from "@/lib/admin/actions";

const navItems = [
  { href: "/admin", icon: BarChart3, label: "Overview", exact: true },
  { href: "/admin/products", icon: Package, label: "Products" },
  { href: "/admin/stores", icon: Store, label: "Stores" },
  { href: "/admin/coupons", icon: Tag, label: "Coupons" },
  { href: "/admin/deals", icon: ShoppingBag, label: "Deals" },
];

type AdminShellProps = {
  children: React.ReactNode;
  userName?: string | null;
  userEmail?: string | null;
};

export default function AdminShell({ children, userName, userEmail }: AdminShellProps) {
  const pathname = usePathname();
  const normalizedPath = pathname.replace(/^\/(en|ar)/, "") || pathname;

  return (
    <div className="min-h-screen bg-[#020611] text-white">
      <div className="lg:hidden sticky top-0 z-40 border-b border-gray-800 bg-[#020611]/95 backdrop-blur px-4 py-3 flex items-center justify-between">
        <div>
          <p className="font-bold">Zorino Admin</p>
          <p className="text-xs text-gray-400 truncate max-w-[200px]">{userEmail}</p>
        </div>
        <MobileNav normalizedPath={normalizedPath} />
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 lg:gap-8">
          <aside className="hidden lg:block">
            <Sidebar
              normalizedPath={normalizedPath}
              userName={userName}
              userEmail={userEmail}
            />
          </aside>
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  normalizedPath,
  userName,
  userEmail,
}: {
  normalizedPath: string;
  userName?: string | null;
  userEmail?: string | null;
}) {
  return (
    <div className="sticky top-8 rounded-2xl border border-gray-800 bg-gray-900/50 backdrop-blur p-4">
      <div className="mb-6 px-2">
        <p className="text-lg font-bold">Zorino Admin</p>
        <p className="text-sm text-gray-400 mt-1">{userName ?? "Admin"}</p>
        <p className="text-xs text-gray-500 truncate">{userEmail}</p>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const active = item.exact
            ? normalizedPath === item.href
            : normalizedPath.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                active
                  ? "bg-purple-500/20 text-purple-300"
                  : "text-gray-400 hover:bg-gray-800/60 hover:text-white"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <form action={adminSignOut} className="mt-6 pt-4 border-t border-gray-800">
        <button
          type="submit"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </form>
    </div>
  );
}

function MobileNav({ normalizedPath }: { normalizedPath: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="p-2 rounded-lg border border-gray-700 text-gray-300"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-4">
          <div className="max-w-xs ml-auto h-full">
            <div className="h-full rounded-2xl border border-gray-800 bg-gray-900 p-4 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <p className="font-bold">Menu</p>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close menu">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <nav className="space-y-1 flex-1">
                {navItems.map((item) => {
                  const active = item.exact
                    ? normalizedPath === item.href
                    : normalizedPath.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm",
                        active ? "bg-purple-500/20 text-purple-300" : "text-gray-400"
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <form action={adminSignOut}>
                <button
                  type="submit"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}