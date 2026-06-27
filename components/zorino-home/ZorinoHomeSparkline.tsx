function buildPath(values: number[], width: number, height: number): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

type ZorinoHomeSparklineProps = {
  values: number[];
  rising?: boolean;
};

export default function ZorinoHomeSparkline({ values, rising = false }: ZorinoHomeSparklineProps) {
  if (values.length < 2) return null;
  const stroke = rising ? "#ef4444" : "#8b5cf6";

  return (
    <svg className="zh-sparkline" viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden>
      <path
        d={buildPath(values, 120, 32)}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
