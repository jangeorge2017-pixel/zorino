'use client';

import { useLocale } from 'next-intl';
import { locales, type Locale } from '@/i18n/config';
import { usePathname, useRouter } from '@/i18n/navigation';
import { languages } from '@/lib/international/config';

export default function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

  const nextLocale: Locale = locale === 'en' ? 'ar' : 'en';

  const switchLocale = () => {
    router.replace(pathname, { locale: nextLocale });
  };

  if (!locales.includes(locale)) return null;

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={switchLocale}
      aria-label={`Switch to ${languages[nextLocale].label}`}
    >
      <span className="theme-option theme-option-active">
        {languages[locale].flag} {locale.toUpperCase()}
      </span>
    </button>
  );
}
