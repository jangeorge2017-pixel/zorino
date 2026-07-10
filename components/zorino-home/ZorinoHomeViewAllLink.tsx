"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import "./view-all-link.css";

export type ZorinoHomeViewAllVariant = "coupons" | "deals" | "products";

type ZorinoHomeViewAllLinkProps = {
  href: string;
  variant: ZorinoHomeViewAllVariant;
};

export default function ZorinoHomeViewAllLink({ href, variant }: ZorinoHomeViewAllLinkProps) {
  const tDeals = useTranslations("deals");
  const tCoupons = useTranslations("coupons");

  const label =
    variant === "coupons"
      ? tCoupons("viewAllCoupons")
      : variant === "deals"
        ? tDeals("viewAllDeals")
        : tDeals("viewAllProducts");

  return (
    <Link href={href} className="zh-view-all">
      <span className="zh-view-all__label">{label}</span>
      <ChevronRight size={14} className="zh-view-all__icon" aria-hidden />
    </Link>
  );
}
