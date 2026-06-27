import {
  DYNAMIC_BADGE_LABELS,
  type DynamicBadgeType,
} from "@/lib/homepage/badges";
import { TrendingDown } from "lucide-react";

type ProductDynamicBadgeProps = {
  type: DynamicBadgeType;
  size?: "sm" | "md";
};

export default function ProductDynamicBadge({
  type,
  size = "sm",
}: ProductDynamicBadgeProps) {
  return (
    <span className={`dynamic-badge dynamic-badge--${type} dynamic-badge--${size}`}>
      {type === "price-dropped" ? (
        <>
          <TrendingDown size={12} aria-hidden="true" />
          {DYNAMIC_BADGE_LABELS[type]}
        </>
      ) : (
        DYNAMIC_BADGE_LABELS[type]
      )}
    </span>
  );
}
