import type { ReactNode } from "react";

type PageIdentityCtaProps = {
  block: string;
  title: string;
  description: string;
  children: ReactNode;
};

export default function PageIdentityCta({
  block,
  title,
  description,
  children,
}: PageIdentityCtaProps) {
  const base = `${block}__cta`;

  return (
    <section className={base} aria-labelledby={`${base}-title`}>
      <div className={`${base}-inner`}>
        <h2 id={`${base}-title`} className={`${base}-title`}>
          {title}
        </h2>
        <p className={`${base}-text`}>{description}</p>
        <div className={`${base}-actions`}>{children}</div>
      </div>
    </section>
  );
}
