import "./home-hero-background.css";

type HomeHeroBackgroundProps = {
  children: React.ReactNode;
  className?: string;
  label?: string;
};

export default function HomeHeroBackground({
  children,
  className,
  label = "Home content",
}: HomeHeroBackgroundProps) {
  return (
    <section className={className ? `hhb ${className}` : "hhb"} aria-label={label}>
      <div className="hhb__backdrop" aria-hidden="true">
        <div className="hhb__nebula" />
        <div className="hhb__stars" />
        <div className="hhb__streaks" />
        <div className="hhb__ambient-glow" />
      </div>
      <div className="hhb__content">{children}</div>
    </section>
  );
}
