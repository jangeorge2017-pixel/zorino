"use client";

import { PageErrorState } from "@/components/pages";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageErrorState
      title="Something went wrong"
      description="We couldn't load this page. Please try again."
      onRetry={reset}
    />
  );
}
