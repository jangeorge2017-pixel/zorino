"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import OfficialPageHero from "@/components/official/OfficialPageHero";
import { PageLayout } from "@/components/pages";
import { CheckCircle, HeadphonesIcon, Mail, MapPin, MessageSquare, Phone, Send } from "lucide-react";
import { getContactEmail } from "@/lib/site-url";

export default function ContactPageClient() {
  const t = useTranslations("contact");
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setIsSubmitting(false);
    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      setFormData({ name: "", email: "", subject: "", message: "" });
    }, 3000);
  };

  const contactInfo = [
    { icon: Mail, label: "Email", value: getContactEmail("support"), link: `mailto:${getContactEmail("support")}` },
    { icon: Phone, label: "Phone", value: "+971 4 123 4567", link: "tel:+97141234567" },
    { icon: MapPin, label: "Office", value: "123 Tech Street, Dubai, UAE", link: null },
  ];

  const supportOptions = [
    { icon: MessageSquare, title: "General Inquiries", description: "Platform features and services", email: getContactEmail("info") },
    { icon: HeadphonesIcon, title: "Technical Support", description: "Account issues and bug reports", email: getContactEmail("support") },
    { icon: Send, title: "Partnerships", description: "Affiliate and business collaborations", email: getContactEmail("partnerships") },
  ];

  return (
    <PageLayout>
      <div className="zor-official">
        <OfficialPageHero title={t("title")} subtitle={t("subtitle")} badge="Support" centered />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          <Card className="zor-official-section">
            <h2 className="text-xl font-bold text-white mb-6">{t("sendMessage")}</h2>
            {isSubmitted ? (
              <div className="text-center py-12 zor-official-section">
                <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">{t("messageSent")}</h3>
                <p className="text-[var(--zor-text-muted)]">We&apos;ll respond within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                  <Input label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
                </div>
                <Input label="Subject" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} required />
                <div className="zor-field">
                  <label className="zor-label" htmlFor="contact-message">Message</label>
                  <textarea
                    id="contact-message"
                    rows={5}
                    className="zor-input resize-none"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Sending..." : t("sendMessage")}
                </Button>
              </form>
            )}
          </Card>

          <div className="space-y-5">
            {contactInfo.map((item) => (
              <Card key={item.label} hover className="zor-official-section">
                <div className="flex items-center gap-4">
                  <div className="zor-official-section__icon">
                    <item.icon size={20} />
                  </div>
                  <div>
                    <p className="text-[var(--zor-text-muted)] text-sm">{item.label}</p>
                    {item.link ? (
                      <a href={item.link} className="text-white font-medium hover:text-[var(--zor-purple-light)] transition-colors">
                        {item.value}
                      </a>
                    ) : (
                      <p className="text-white font-medium">{item.value}</p>
                    )}
                  </div>
                </div>
              </Card>
            ))}

            <Card className="zor-official-cta">
              <h3 className="font-semibold text-white mb-4">Department Contacts</h3>
              <div className="space-y-4">
                {supportOptions.map((opt) => (
                  <div key={opt.title} className="flex gap-3">
                    <div className="zor-official-section__icon w-10 h-10 shrink-0">
                      <opt.icon size={18} />
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">{opt.title}</p>
                      <p className="text-[var(--zor-text-muted)] text-xs mb-1">{opt.description}</p>
                      <a href={`mailto:${opt.email}`} className="text-[var(--zor-purple-light)] text-sm hover:underline">
                        {opt.email}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        <Card className="text-center zor-official-cta">
          <h2 className="zor-official-cta__title">Check our FAQ first</h2>
          <p className="zor-official-cta__text">Many common questions are answered in our help center.</p>
          <Link href="/faq"><Button variant="outline">Visit FAQ</Button></Link>
        </Card>
      </div>
    </PageLayout>
  );
}
