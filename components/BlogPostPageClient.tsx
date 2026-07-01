"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { PageHeader, PageLayout } from "@/components/pages";
import { ArrowLeft, Calendar, Clock, User } from "lucide-react";
import type { MockBlogPost } from "@/lib/mock/types";

type BlogPostPageClientProps = {
  post: MockBlogPost;
  related: MockBlogPost[];
};

export default function BlogPostPageClient({ post, related }: BlogPostPageClientProps) {
  return (
    <PageLayout>
      <Link href="/blog" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Blog
      </Link>

      <article>
        <PageHeader title={post.title} subtitle={post.excerpt} />

        <div className="flex flex-wrap items-center gap-6 text-sm text-gray-400 mb-8">
          <span className="flex items-center gap-2"><User className="w-4 h-4" />{post.author}</span>
          <span className="flex items-center gap-2"><Calendar className="w-4 h-4" />{post.publishedAt}</span>
          <span className="flex items-center gap-2"><Clock className="w-4 h-4" />{post.readingTime}</span>
          <span className="text-purple-400">{post.category}</span>
        </div>

        <Card className="mb-8">
          <div className="text-8xl text-center py-12">{post.image}</div>
        </Card>

        <div className="prose prose-invert max-w-none space-y-6 mb-12">
          {post.content.map((paragraph, index) => (
            <p key={index} className="text-gray-300 text-lg leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-12">
          {post.tags.map((tag) => (
            <span key={tag} className="bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full">
              #{tag}
            </span>
          ))}
        </div>
      </article>

      {related.length > 0 ? (
        <section>
          <h2 className="text-2xl font-bold text-white mb-6">Related Articles</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {related.map((item) => (
              <Card key={item.id} hover>
                <div className="text-4xl mb-3">{item.image}</div>
                <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2">{item.title}</h3>
                <Link href={`/blog/${item.slug}`}>
                  <Button variant="outline" size="sm" className="w-full mt-2">Read More</Button>
                </Link>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </PageLayout>
  );
}
