function buildSparklinePath(values: number[], width: number, height: number): string {
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

export default function ZorinoBlueprintSparkline({
  values,
  stroke = "#ef4444",
}: {
  values: number[];
  stroke?: string;
}) {
  if (values.length < 2) return null;
  const path = buildSparklinePath(values, 120, 32);
  return (
    <svg className="zb-sparkline" viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden>
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
