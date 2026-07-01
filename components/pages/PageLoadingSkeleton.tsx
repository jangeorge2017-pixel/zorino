export default function PageLoadingSkeleton() {
  return (
    <div className="zor-page-loading" aria-busy="true" aria-label="Loading">
      <div className="zor-skeleton zor-skeleton--title" />
      <div className="zor-skeleton zor-skeleton--subtitle" />
      <div className="zor-skeleton zor-skeleton--filter" />
      <div className="zor-page-loading__grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="zor-skeleton zor-skeleton--card" />
        ))}
      </div>
    </div>
  );
}
