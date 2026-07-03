"use client";

import { BookOpen, Eye, Feather, Newspaper } from "lucide-react";

type BlogPageHeroProps = {
  title: string;
  subtitle: string;
  articleCount: number;
  featuredCount: number;
  categoryCount: number;
  totalViews: number;
};

export default function BlogPageHero({
  title,
  subtitle,
  articleCount,
  featuredCount,
  categoryCount,
  totalViews,
}: BlogPageHeroProps) {
  return (
    <section className="zor-blog-page__hero" aria-labelledby="blog-page-title">
      <div className="zor-blog-page__hero-glow" aria-hidden />

      <div className="zor-blog-page__hero-inner">
        <div className="zor-blog-page__hero-copy">
          <p className="zor-blog-page__eyebrow">
            <Feather size={14} aria-hidden />
            Zorino editorial
          </p>
          <h1 id="blog-page-title" className="zor-blog-page__title">
            {title}
          </h1>
          <p className="zor-blog-page__subtitle">{subtitle}</p>
        </div>

        <div className="zor-blog-page__stats" aria-label="Blog overview">
          <div className="zor-blog-page__stat">
            <span className="zor-blog-page__stat-icon" aria-hidden>
              <Newspaper size={15} />
            </span>
            <div>
              <strong>{articleCount}</strong>
              <span>Articles</span>
            </div>
          </div>
          <div className="zor-blog-page__stat zor-blog-page__stat--hot">
            <span className="zor-blog-page__stat-icon" aria-hidden>
              <BookOpen size={15} />
            </span>
            <div>
              <strong>{featuredCount}</strong>
              <span>Editor&apos;s picks</span>
            </div>
          </div>
          <div className="zor-blog-page__stat">
            <span className="zor-blog-page__stat-icon" aria-hidden>
              <Feather size={15} />
            </span>
            <div>
              <strong>{categoryCount}</strong>
              <span>Topics</span>
            </div>
          </div>
          <div className="zor-blog-page__stat">
            <span className="zor-blog-page__stat-icon" aria-hidden>
              <Eye size={15} />
            </span>
            <div>
              <strong>{totalViews.toLocaleString()}</strong>
              <span>Total reads</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
