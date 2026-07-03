"use client";

import Link from "next/link";
import { ArrowLeft, Calendar, Clock, User } from "lucide-react";
import type { MockBlogPost } from "@/lib/mock/types";

type BlogPostHeroProps = {
  post: MockBlogPost;
  featuredLabel?: string;
};

export default function BlogPostHero({ post, featuredLabel }: BlogPostHeroProps) {
  return (
    <section className="zor-blog-page__detail-hero" aria-labelledby="blog-post-title">
      <div className="zor-blog-page__hero-glow" aria-hidden />
      <Link href="/blog" className="zor-blog-page__back">
        <ArrowLeft size={14} aria-hidden />
        Back to Blog
      </Link>

      <div className="zor-blog-page__detail-inner">
        <div className="zor-blog-page__detail-media" aria-hidden>{post.image}</div>
        <div className="zor-blog-page__detail-copy">
          <div className="zor-blog-page__card-tags">
            {post.featured && featuredLabel ? (
              <span className="zor-blog-page__card-featured-badge">{featuredLabel}</span>
            ) : null}
            <span className="zor-blog-page__card-category">{post.category}</span>
          </div>
          <h1 id="blog-post-title" className="zor-blog-page__title zor-blog-page__detail-title">
            {post.title}
          </h1>
          <p className="zor-blog-page__subtitle">{post.excerpt}</p>
          <div className="zor-blog-page__card-meta">
            <span><User size={14} aria-hidden />{post.author}</span>
            <span><Calendar size={14} aria-hidden />{post.publishedAt}</span>
            <span><Clock size={14} aria-hidden />{post.readingTime}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
