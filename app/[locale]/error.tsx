"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { PageErrorState, PageLayout } from "@/components/pages";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");

  useEffect(() => {
    console.error("[locale-error]", error?.message, error?.digest, error);
  }, [error]);

  return (
    <PageLayout>
      <PageErrorState
        title={t("somethingWentWrong")}
        description={t("pageLoadFailed")}
        onRetry={reset}
      />
    </PageLayout>
  );
}
