import { cn } from "@/lib/utils/cn";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="zor-field">
      {label ? <label className="zor-label">{label}</label> : null}
      <input
        className={cn("zor-input", error && "zor-input--error", className)}
        {...props}
      />
      {error ? <p className="zor-field-error">{error}</p> : null}
    </div>
  );
}
