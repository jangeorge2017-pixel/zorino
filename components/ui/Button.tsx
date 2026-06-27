import { cn } from "@/lib/utils/cn";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export default function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "zor-btn",
        variant === "primary" && "zor-btn--primary",
        variant === "secondary" && "zor-btn--secondary",
        variant === "outline" && "zor-btn--outline",
        variant === "ghost" && "zor-btn--ghost",
        size === "sm" && "zor-btn--sm",
        size === "md" && "zor-btn--md",
        size === "lg" && "zor-btn--lg",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
