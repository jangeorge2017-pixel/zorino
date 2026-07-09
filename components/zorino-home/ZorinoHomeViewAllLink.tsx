import Link from "next/link";
import { ChevronRight } from "lucide-react";
import "./view-all-link.css";

export type ZorinoHomeViewAllVariant = "coupons" | "deals" | "products";

const VIEW_ALL_LABELS: Record<ZorinoHomeViewAllVariant, string> = {
  coupons: "View All Coupons",
  deals: "View All Deals",
  products: "View All Products",
};

type ZorinoHomeViewAllLinkProps = {
  href: string;
  variant: ZorinoHomeViewAllVariant;
};

export default function ZorinoHomeViewAllLink({ href, variant }: ZorinoHomeViewAllLinkProps) {
  return (
    <Link href={href} className="zh-view-all">
      <span className="zh-view-all__label">{VIEW_ALL_LABELS[variant]}</span>
      <ChevronRight size={14} className="zh-view-all__icon" aria-hidden />
    </Link>
  );
}
