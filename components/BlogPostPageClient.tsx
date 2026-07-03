"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import Button from "@/components/ui/Button";
import BlogArticleCard from "@/components/blog/BlogArticleCard";
import BlogPostHero from "@/components/blog/BlogPostHero";
import PageIdentityCta from "@/components/page-identity/PageIdentityCta";
import { PageLayout } from "@/components/pages";
import type { MockBlogPost } from "@/lib/mock/types";
import "@/components/blog/blog-page.css";

type BlogPostPageClientProps = {
  post: MockBlogPost;
  related: MockBlogPost[];
};

export default function BlogPostPageClient({ post, related }: BlogPostPageClientProps) {
  const t = useTranslations("blog");
  const tCommon = useTranslations("common");

  return (
    <PageLayout>
      <div className="zor-blog-page">
        <BlogPostHero post={post} featuredLabel={tCommon("featured")} />

        <article className="zor-blog-page__article">
          <div className="zor-blog-page__article-body">
            {post.content.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </article>

        <div className="zor-blog-page__tags">
          {post.tags.map((tag) => (
            <span key={tag} className="zor-blog-page__tag">
              #{tag}
            </span>
          ))}
        </div>

        {related.length > 0 ? (
          <section aria-labelledby="related-articles-title">
            <h2 id="related-articles-title" className="zor-blog-page__related-title">
              {t("relatedArticles")}
            </h2>
            <div className="zor-blog-page__grid">
              {related.map((item) => (
                <BlogArticleCard
                  key={item.id}
                  post={item}
                  readLabel={t("readArticle")}
                  featuredLabel={tCommon("featured")}
                />
              ))}
            </div>
          </section>
        ) : null}

        <PageIdentityCta
          block="zor-blog-page"
          title="Ready to put this guide into action?"
          description="Compare live prices, grab verified coupons, and shop partner stores with confidence."
        >
          <Link href="/deals"><Button>Shop Deals</Button></Link>
          <Link href="/blog"><Button variant="outline">Back to Blog</Button></Link>
        </PageIdentityCta>
      </div>
    </PageLayout>
  );
}
