type PriceSparklineProps = {
  data: number[];
  id: string | number;
  variant?: "default" | "green" | "orange" | "purple" | "cyan" | "red" | "gold";
};

const GRADIENTS: Record<NonNullable<PriceSparklineProps["variant"]>, [string, string]> = {
  default: ["#8b5cf6", "#3b82f6"],
  green: ["#22c55e", "#4ade80"],
  orange: ["#f97316", "#fb923c"],
  purple: ["#8b5cf6", "#a78bfa"],
  cyan: ["#06b6d4", "#22d3ee"],
  red: ["#ef4444", "#f87171"],
  gold: ["#eab308", "#facc15"],
};

export default function PriceSparkline({
  data,
  id,
  variant = "default",
}: PriceSparklineProps) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 28;
  const gradientId = `spark-${variant}-${id}`;
  const [start, end] = GRADIENTS[variant];
  const points = data
    .map((value, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="price-sparkline" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={start} />
          <stop offset="100%" stopColor={end} />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
