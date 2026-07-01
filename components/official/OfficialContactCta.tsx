import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Mail } from "lucide-react";

type OfficialContactCtaProps = {
  heading: string;
  description: string;
  email?: string;
  showContactLink?: boolean;
};

export default function OfficialContactCta({
  heading,
  description,
  email,
  showContactLink = true,
}: OfficialContactCtaProps) {
  return (
    <Card className="zor-official-cta">
      <h2 className="zor-official-cta__title">{heading}</h2>
      <p className="zor-official-cta__text">{description}</p>
      {email ? (
        <p className="flex items-center justify-center gap-2 text-[var(--zor-text)] mb-5">
          <Mail size={16} className="text-[var(--zor-purple-light)]" aria-hidden />
          <a href={`mailto:${email}`} className="hover:text-[var(--zor-purple-light)] transition-colors">
            {email}
          </a>
        </p>
      ) : null}
      {showContactLink ? (
        <div className="zor-official-cta__actions">
          <Link href="/contact">
            <Button>Contact Us</Button>
          </Link>
          <Link href="/faq">
            <Button variant="outline">Visit FAQ</Button>
          </Link>
        </div>
      ) : null}
    </Card>
  );
}
