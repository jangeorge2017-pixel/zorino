import type { ReactNode } from "react";
import Button from "@/components/ui/Button";
import { Inbox } from "lucide-react";

type PageEmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
};

export default function PageEmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: PageEmptyStateProps) {
  return (
    <div className="zor-page-state zor-page-state--empty">
      <div className="zor-page-state__icon" aria-hidden>
        {icon ?? <Inbox size={40} />}
      </div>
      <h2 className="zor-page-state__title">{title}</h2>
      {description ? <p className="zor-page-state__text">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button onClick={onAction} className="mt-4">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
