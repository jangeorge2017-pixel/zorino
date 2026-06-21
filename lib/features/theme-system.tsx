// Theme System (Dark/Light Mode)
// This file implements the dark/light mode toggle functionality

import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({ children, ...props }: any) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

export const themes = {
  light: 'light',
  dark: 'dark',
  system: 'system',
} as const;

export type Theme = typeof themes[keyof typeof themes];

export function getThemeIcon(theme: Theme): string {
  switch (theme) {
    case 'light':
      return '☀️';
    case 'dark':
      return '🌙';
    case 'system':
      return '💻';
    default:
      return '☀️';
  }
}

export function getThemeLabel(theme: Theme): string {
  switch (theme) {
    case 'light':
      return 'Light';
    case 'dark':
      return 'Dark';
    case 'system':
      return 'System';
    default:
      return 'Light';
  }
}

export function getThemeLabelAr(theme: Theme): string {
  switch (theme) {
    case 'light':
      return 'فاتح';
    case 'dark':
      return 'داكن';
    case 'system':
      return 'النظام';
    default:
      return 'فاتح';
  }
}
