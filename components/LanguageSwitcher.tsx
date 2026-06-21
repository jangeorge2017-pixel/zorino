'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { locales, type Locale } from '@/i18n/request';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const switchLocale = (newLocale: Locale) => {
    const segments = pathname.split('/');
    segments[1] = newLocale;
    const newPath = segments.join('/');
    router.push(newPath);
  };

  return (
    <button 
      className="theme-btn"
      onClick={() => switchLocale(locale === 'en' ? 'ar' : 'en')}
    >
      {locale === 'en' ? '🇺🇸 EN' : '🇸🇦 AR'}
    </button>
  );
}