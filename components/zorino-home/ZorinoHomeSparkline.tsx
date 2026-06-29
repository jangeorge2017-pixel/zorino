"use client";

import { useId } from "react";

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
  const gradientId = useId();
  const width = 120;
  const height = 32;
  const stroke = rising ? "#ef4444" : "#7c3aed";

  if (values.length < 2) {
    return (
      <svg
        className="zh-sparkline"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke={stroke}
          strokeWidth="1.5"
          strokeOpacity="0.4"
        />
      </svg>
    );
  }

  const fillStart = rising ? "rgba(239, 68, 68, 0.28)" : "rgba(124, 58, 237, 0.28)";
  const fillEnd = rising ? "rgba(239, 68, 68, 0)" : "rgba(124, 58, 237, 0)";

  return (
    <svg className="zh-sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillStart} />
          <stop offset="100%" stopColor={fillEnd} />
        </linearGradient>
      </defs>
      <path d={buildAreaPath(values, width, height)} fill={`url(#${gradientId})`} />
      <path
        d={buildPath(values, width, height)}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
