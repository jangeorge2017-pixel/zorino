import type { ReactNode } from "react";

type PageFilterBarProps = {
  children: ReactNode;
  className?: string;
};

export default function PageFilterBar({ children, className = "" }: PageFilterBarProps) {
  return <div className={`zor-filter-bar ${className}`.trim()}>{children}</div>;
}
