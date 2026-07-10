"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import Card from "@/components/ui/Card";
import OfficialContactCta from "@/components/official/OfficialContactCta";
import OfficialPageHero from "@/components/official/OfficialPageHero";
import { PageLayout } from "@/components/pages";
import {
  ChevronDown,
  CreditCard,
  HelpCircle,
  RefreshCw,
  ShoppingBag,
  Truck,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type FaqItem = { q: string; a: string };
type FaqCategory = { id: string; icon: LucideIcon; title: string; questions: FaqItem[] };

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: "general",
    icon: HelpCircle,
    title: "General",
    questions: [
      { q: "What is ZORINO?", a: "ZORINO is an AI-powered deal discovery and price comparison platform that helps you find the best prices across thousands of online stores." },
      { q: "Is ZORINO free?", a: "Yes. ZORINO is free for shoppers. We earn affiliate commissions from partner stores when you purchase through our links — at no extra cost to you." },
      { q: "How does ZORINO make money?", a: "We earn small affiliate commissions when you buy from partner retailers through our tracked links. This supports our free platform." },
    ],
  },
  {
    id: "account",
    icon: User,
    title: "Account",
    questions: [
      { q: "How do I create an account?", a: "Click Register in the header or sign up with Google. An account unlocks wishlists, price alerts, and personalized recommendations." },
      { q: "Can I browse without an account?", a: "Yes. You can search deals and compare prices without signing in. An account adds saved lists and alerts." },
      { q: "How do I reset my password?", a: "Use Forgot Password on the login page. We'll email you a secure reset link." },
    ],
  },
  {
    id: "deals",
    icon: ShoppingBag,
    title: "Deals & Coupons",
    questions: [
      { q: "How do I find the best deals?", a: "Search products, browse categories, or visit our Deals and Coupons pages. Set price alerts for automatic notifications." },
      { q: "How do coupon codes work?", a: "Copy a code from our Coupons page and apply it at the retailer's checkout. Check each coupon's terms before use." },
      { q: "Are deals verified?", a: "We verify listings before publication and remove expired or invalid offers regularly." },
    ],
  },
  {
    id: "payments",
    icon: CreditCard,
    title: "Payments",
    questions: [
      { q: "Do I pay through ZORINO?", a: "No. All purchases are completed on the retailer's website. ZORINO does not process payments." },
      { q: "Is my payment information safe?", a: "Yes. We never see or store payment details — retailers handle transactions directly." },
      { q: "What payment methods are accepted?", a: "Payment options vary by retailer (cards, PayPal, Apple Pay, etc.). Check the store's checkout page." },
    ],
  },
  {
    id: "shipping",
    icon: Truck,
    title: "Shipping",
    questions: [
      { q: "Who handles shipping?", a: "The retailer you purchase from handles all shipping and delivery." },
      { q: "How do I track my order?", a: "Use the tracking information in your order confirmation email from the retailer." },
      { q: "How do returns work?", a: "Contact the retailer's customer service per their return policy." },
    ],
  },
  {
    id: "technical",
    icon: RefreshCw,
    title: "Technical",
    questions: [
      { q: "How do price alerts work?", a: "Set a target price on any product. We'll notify you when the price drops below your threshold." },
      { q: "How does Compare work?", a: "Add products to compare side-by-side across stores for price, ratings, and availability." },
      { q: "Is my data secure?", a: "We use encryption and industry-standard security. See our Privacy Policy for details." },
    ],
  },
];

export default function FAQPageClient() {
  const t = useTranslations("faq");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const toggle = (key: string) => setOpenKey(openKey === key ? null : key);

  return (
    <PageLayout>
      <div className="zor-official max-w-4xl mx-auto">
        <OfficialPageHero title={t("title")} subtitle={t("subtitle")} badge="Help Center" centered />

        <nav className="zor-official-toc mb-8" aria-label="FAQ categories">
          {FAQ_CATEGORIES.map((cat) => (
            <a key={cat.id} href={`#faq-${cat.id}`} className="zor-official-toc__link">
              {cat.title}
            </a>
          ))}
        </nav>

        {FAQ_CATEGORIES.map((category) => (
          <section key={category.id} id={`faq-${category.id}`} className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="zor-official-section__icon">
                <category.icon size={20} />
              </div>
              <h2 className="text-xl font-bold text-white">{category.title}</h2>
            </div>
            <div className="space-y-3">
              {category.questions.map((faq, qIndex) => {
                const key = `${category.id}-${qIndex}`;
                const isOpen = openKey === key;
                return (
                  <Card
                    key={key}
                    className={`zor-faq-item zor-official-section${isOpen ? " zor-faq-item--open" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      className="w-full text-left flex items-center justify-between gap-4"
                      aria-expanded={isOpen}
                    >
                      <span className="font-semibold text-white">{faq.q}</span>
                      <ChevronDown
                        size={18}
                        className={`text-[var(--zor-text-muted)] shrink-0 transition-transform duration-300${isOpen ? " rotate-180" : ""}`}
                      />
                    </button>
                    <div className="zor-faq-item__answer">
                      <div className="zor-faq-item__answer-inner">
                        <p className="text-[var(--zor-text-soft)] pt-4 leading-relaxed">{faq.a}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}

        <OfficialContactCta
          heading="Still have questions?"
          description="Our support team is ready to help with anything not covered here."
        />
      </div>
    </PageLayout>
  );
}
