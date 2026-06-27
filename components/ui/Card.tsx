import { cn } from "@/lib/utils/cn";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export default function Card({ children, className, hover = false }: CardProps) {
  return (
    <div className={cn("zor-card", hover && "zor-card--hover", className)}>
      {children}
    </div>
  );
}
