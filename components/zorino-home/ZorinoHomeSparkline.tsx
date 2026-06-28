function buildPath(values: number[], width: number, height: number): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / range) * (height - 6) - 3;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function buildAreaPath(values: number[], width: number, height: number): string {
  const line = buildPath(values, width, height);
  if (!line) return "";
  return `${line} L${width},${height} L0,${height} Z`;
}

type ZorinoHomeSparklineProps = {
  values: number[];
  rising?: boolean;
};

export default function ZorinoHomeSparkline({ values, rising = false }: ZorinoHomeSparklineProps) {
  if (values.length < 2) return null;

  const stroke = rising ? "#ef4444" : "#8b5cf6";
  const fillStart = rising ? "rgba(239, 68, 68, 0.28)" : "rgba(139, 92, 246, 0.28)";
  const fillEnd = rising ? "rgba(239, 68, 68, 0)" : "rgba(139, 92, 246, 0)";

  return (
    <svg className="zh-sparkline" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`zh-spark-${rising ? "up" : "down"}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillStart} />
          <stop offset="100%" stopColor={fillEnd} />
        </linearGradient>
      </defs>
      <path d={buildAreaPath(values, 120, 36)} fill={`url(#zh-spark-${rising ? "up" : "down"})`} />
      <path
        d={buildPath(values, 120, 36)}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
