import Link from "next/link";
import { ChevronDown } from "lucide-react";

type ReferenceSectionHeaderProps = {
  title: string;
  headingId: string;
  linkHref: string;
  linkLabel: string;
};

export default function ReferenceSectionHeader({
  title,
  headingId,
  linkHref,
  linkLabel,
}: ReferenceSectionHeaderProps) {
  return (
    <header className="ref-section-header">
      <h2 id={headingId} className="ref-section-title">
        <span className="ref-section-flame" aria-hidden="true">
          🔥
        </span>
        {title}
      </h2>
      <Link href={linkHref} className="ref-section-link">
        {linkLabel}
        <ChevronDown size={14} aria-hidden="true" />
      </Link>
    </header>
  );
}
