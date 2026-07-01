import Button from "@/components/ui/Button";
import { AlertTriangle } from "lucide-react";

type PageErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
};

export default function PageErrorState({
  title = "Something went wrong",
  description = "We couldn't load this page. Please try again.",
  onRetry,
}: PageErrorStateProps) {
  return (
    <div className="zor-page-state zor-page-state--error">
      <div className="zor-page-state__icon zor-page-state__icon--error" aria-hidden>
        <AlertTriangle size={40} />
      </div>
      <h2 className="zor-page-state__title">{title}</h2>
      <p className="zor-page-state__text">{description}</p>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry} className="mt-4">
          Try Again
        </Button>
      ) : null}
    </div>
  );
}
