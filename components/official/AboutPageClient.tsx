"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import OfficialContactCta from "@/components/official/OfficialContactCta";
import OfficialPageHero from "@/components/official/OfficialPageHero";
import { PageLayout } from "@/components/pages";
import { Award, Eye, Globe, Heart, Shield, Target, Users, Zap } from "lucide-react";

export default function AboutPageClient() {
  const t = useTranslations("about");

  const values = [
    { icon: Target, title: "Mission", description: "Empower shoppers worldwide with tools to make informed decisions and save on every purchase." },
    { icon: Eye, title: "Vision", description: "Become the world's most trusted platform for deal discovery, price comparison, and smart shopping." },
    { icon: Heart, title: "Values", description: "Transparency, user privacy, and real value — your trust is our greatest asset." },
  ];

  const stats = [
    { icon: Users, label: "Active Users", value: "2M+" },
    { icon: Globe, label: "Countries", value: "150+" },
    { icon: Zap, label: "Deals Tracked", value: "50M+" },
    { icon: Award, label: "Saved by Shoppers", value: "$500M+" },
  ];

  const team = [
    { name: "Ahmed Hassan", role: "CEO & Founder", image: "👨‍💼", bio: "Making shopping smarter and more affordable for everyone." },
    { name: "Sarah Johnson", role: "CTO", image: "👩‍💻", bio: "15+ years in e-commerce, AI, and large-scale platform engineering." },
    { name: "Mohammed Ali", role: "Head of Product", image: "👨‍🎨", bio: "Focused on seamless, premium user experiences." },
    { name: "Fatima Al-Rashid", role: "Head of Marketing", image: "👩‍🎤", bio: "Connecting communities with deals that matter." },
  ];

  const features = [
    { icon: Shield, title: "Trusted Platform", description: "Verified deals from reputable partner stores" },
    { icon: Zap, title: "Real-Time Updates", description: "Instant alerts when prices drop or new deals appear" },
    { icon: Globe, title: "Global Coverage", description: "Deals from stores in 150+ countries" },
    { icon: Users, title: "Community Driven", description: "Ratings and insights from real shoppers" },
    { icon: Award, title: "Best Price Focus", description: "AI-powered comparison across marketplaces" },
    { icon: Heart, title: "Privacy First", description: "Enterprise-grade security for your data" },
  ];

  return (
    <PageLayout>
      <div className="zor-official">
        <OfficialPageHero
          title={t("title")}
          subtitle={t("subtitle")}
          badge="About ZORINO"
          centered
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {values.map((value) => (
            <Card key={value.title} hover className="zor-official-section text-center">
              <div className="zor-official-section__icon mx-auto mb-4">
                <value.icon size={22} />
              </div>
              <h3 className="zor-official-section__title">{value.title}</h3>
              <p className="zor-official-section__body text-sm">{value.description}</p>
            </Card>
          ))}
        </div>

        <div className="zor-official-stat-grid">
          {stats.map((stat) => (
            <div key={stat.label} className="zor-official-stat">
              <div className="zor-official-section__icon mx-auto mb-3 w-10 h-10">
                <stat.icon size={18} />
              </div>
              <div className="zor-official-stat__value">{stat.value}</div>
              <div className="zor-official-stat__label">{stat.label}</div>
            </div>
          ))}
        </div>

        <Card className="mb-8 zor-official-cta border-purple-500/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">{t("story")}</h2>
              <p className="text-[var(--zor-text-soft)] leading-relaxed mb-4">
                ZORINO was founded to solve a simple problem: finding the best price shouldn&apos;t take hours.
                We aggregate deals from thousands of stores, compare prices with AI, and deliver personalized
                recommendations so you save time and money.
              </p>
              <p className="text-[var(--zor-text-soft)] leading-relaxed">
                Today, millions of shoppers trust ZORINO for deal discovery, coupons, and price tracking —
                and we&apos;re just getting started.
              </p>
            </div>
            <div className="text-8xl text-center" aria-hidden>🚀</div>
          </div>
        </Card>

        <h2 className="text-2xl font-bold text-white mb-6 text-center">{t("team")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {team.map((member) => (
            <Card key={member.name} hover className="text-center zor-official-section">
              <div className="text-5xl mb-3" aria-hidden>{member.image}</div>
              <h3 className="font-semibold text-white">{member.name}</h3>
              <p className="text-[var(--zor-purple-light)] text-sm mb-2">{member.role}</p>
              <p className="text-[var(--zor-text-muted)] text-sm">{member.bio}</p>
            </Card>
          ))}
        </div>

        <h2 className="text-2xl font-bold text-white mb-6 text-center">Why Choose ZORINO?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
          {features.map((feature) => (
            <Card key={feature.title} hover className="zor-official-section">
              <div className="flex gap-4">
                <div className="zor-official-section__icon">
                  <feature.icon size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
                  <p className="text-[var(--zor-text-muted)] text-sm">{feature.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="text-center mb-8 bg-gradient-to-r from-purple-600/80 to-indigo-600/80 border-0">
          <h2 className="text-2xl font-bold text-white mb-3">Ready to Start Saving?</h2>
          <p className="text-white/85 mb-6 max-w-xl mx-auto">
            Join millions of smart shoppers. Browse deals, set price alerts, and never overpay again.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/deals"><Button className="bg-white text-purple-700 hover:bg-gray-100">Browse Deals</Button></Link>
            <Link href="/auth/register"><Button variant="outline" className="border-white text-white hover:bg-white/10">Sign Up Free</Button></Link>
          </div>
        </Card>

        <OfficialContactCta
          heading="Want to learn more?"
          description="Reach out for press, partnerships, or general inquiries."
          showContactLink
        />
      </div>
    </PageLayout>
  );
}
