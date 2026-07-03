"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import { ArrowRight, Calendar, Clock, User } from "lucide-react";
import type { MockBlogPost } from "@/lib/mock/types";

type BlogArticleCardProps = {
  post: MockBlogPost;
  readLabel: string;
  featuredLabel?: string;
  variant?: "grid" | "featured";
};

export default function BlogArticleCard({
  post,
  readLabel,
  featuredLabel,
  variant = "grid",
}: BlogArticleCardProps) {
  if (variant === "featured") {
    return (
      <article className="zor-blog-page__card zor-blog-page__card--featured">
        <div className="zor-blog-page__card-featured-media" aria-hidden>
          {post.image}
        </div>
        <div className="zor-blog-page__card-featured-body">
          <div className="zor-blog-page__card-tags">
            {post.featured && featuredLabel ? (
              <span className="zor-blog-page__card-featured-badge">{featuredLabel}</span>
            ) : null}
            <span className="zor-blog-page__card-category">{post.category}</span>
          </div>
          <h3 className="zor-blog-page__card-title zor-blog-page__card-title--featured">
            {post.title}
          </h3>
          <p className="zor-blog-page__card-excerpt">{post.excerpt}</p>
          <div className="zor-blog-page__card-meta">
            <span>
              <User size={14} aria-hidden />
              {post.author}
            </span>
            <span>
              <Calendar size={14} aria-hidden />
              {post.publishedAt}
            </span>
            <span>
              <Clock size={14} aria-hidden />
              {post.readingTime}
            </span>
          </div>
          <Link href={`/blog/${post.slug}`}>
            <Button>
              {readLabel}
              <ArrowRight size={14} aria-hidden />
            </Button>
          </Link>
        </div>
      </article>
    );
  }

  return (
    <article className="zor-blog-page__card">
      <div className="zor-blog-page__card-media" aria-hidden>
        {post.image}
      </div>
      <div className="zor-blog-page__card-tags">
        <span className="zor-blog-page__card-category">{post.category}</span>
        <span className="zor-blog-page__card-date">{post.publishedAt}</span>
      </div>
      <h3 className="zor-blog-page__card-title">{post.title}</h3>
      <p className="zor-blog-page__card-excerpt">{post.excerpt}</p>
      <div className="zor-blog-page__card-meta zor-blog-page__card-meta--compact">
        <span>
          <Clock size={14} aria-hidden />
          {post.readingTime}
        </span>
      </div>
      <Link href={`/blog/${post.slug}`} className="zor-blog-page__card-link">
        <Button variant="outline" size="sm" className="w-full">
          {readLabel}
        </Button>
      </Link>
    </article>
  );
}
