import { PageLayout, PageLoadingSkeleton } from "@/components/pages";

export default function Loading() {
  return (
    <PageLayout>
      <div className="zor-page-loading">
        <PageLoadingSkeleton />
      </div>
    </PageLayout>
  );
}
