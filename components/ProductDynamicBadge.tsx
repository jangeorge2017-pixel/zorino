import {
  DYNAMIC_BADGE_LABELS,
  type DynamicBadgeType,
} from "@/lib/homepage/badges";

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
      {DYNAMIC_BADGE_LABELS[type]}
    </span>
  );
}
