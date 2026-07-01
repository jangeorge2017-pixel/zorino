"use client";

import Card from "@/components/ui/Card";
import OfficialContactCta from "@/components/official/OfficialContactCta";
import OfficialPageHero from "@/components/official/OfficialPageHero";
import { PageLayout } from "@/components/pages";
import type { LegalPageContent } from "@/lib/content/official-pages";

type LegalDocumentClientProps = {
  title: string;
  subtitle: string;
  content: LegalPageContent;
};

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function LegalDocumentClient({ title, subtitle, content }: LegalDocumentClientProps) {
  const { intro, sections, footerNote, contactEmail, contactHeading } = content;

  return (
    <PageLayout>
      <div className="zor-official max-w-4xl mx-auto">
        <OfficialPageHero title={title} subtitle={subtitle} badge="Legal" lastUpdated />

        <nav className="zor-official-toc" aria-label="Table of contents">
          {sections.map((section) => (
            <a
              key={section.title}
              href={`#${slugify(section.title)}`}
              className="zor-official-toc__link"
            >
              {section.title}
            </a>
          ))}
        </nav>

        <Card className="zor-official-intro">
          <p className="text-[var(--zor-text-soft)] leading-relaxed text-[15px]">{intro}</p>
        </Card>

        <div className="space-y-5">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <div key={section.title} id={slugify(section.title)}>
              <Card className="zor-official-section">
                <div className="flex items-start gap-4">
                  <div className="zor-official-section__icon" aria-hidden>
                    <Icon size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="zor-official-section__title">{section.title}</h2>
                    <div className="zor-official-section__body">
                      {section.paragraphs.map((p) => (
                        <p key={p}>{p}</p>
                      ))}
                      {section.bullets?.length ? (
                        <ul className="zor-official-section__list list-disc">
                          {section.bullets.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Card>
              </div>
            );
          })}
        </div>

        {footerNote ? (
          <Card className="mt-6">
            <p className="text-[var(--zor-text-soft)] text-sm leading-relaxed">{footerNote}</p>
          </Card>
        ) : null}

        <OfficialContactCta
          heading={contactHeading ?? "Questions?"}
          description="Our team is available to answer questions about this policy."
          email={contactEmail}
        />
      </div>
    </PageLayout>
  );
}
