"use client";

import { cn } from "@/lib/utils/cn";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export default function Select({ label, error, options, className, ...props }: SelectProps) {
  return (
    <div className="zor-field">
      {label ? <label className="zor-label">{label}</label> : null}
      <select
        className={cn("zor-select", error && "zor-select--error", className)}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <p className="zor-field-error">{error}</p> : null}
    </div>
  );
}
