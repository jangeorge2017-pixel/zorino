import "./ZorinoHomeTrendingDealsSkeleton.css";

type ZorinoHomeTrendingDealsSkeletonProps = {
  count?: number;
};

export default function ZorinoHomeTrendingDealsSkeleton({
  count = 4,
}: ZorinoHomeTrendingDealsSkeletonProps) {
  return (
    <div className="zh-td-skeleton-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="zh-td-skeleton-card">
          <div className="zh-td-skeleton-card__media" />
          <div className="zh-td-skeleton-card__line zh-td-skeleton-card__line--title" />
          <div className="zh-td-skeleton-card__line zh-td-skeleton-card__line--price" />
          <div className="zh-td-skeleton-card__line zh-td-skeleton-card__line--meta" />
          <div className="zh-td-skeleton-card__cta" />
        </div>
      ))}
    </div>
  );
}
