import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="zor-page-header">
      <div className="zor-page-header__row">
        <div>
          <h1 className="zor-page-header__title">{title}</h1>
          {subtitle ? <p className="zor-page-header__subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="zor-page-header__actions">{actions}</div> : null}
      </div>
    </header>
  );
}
