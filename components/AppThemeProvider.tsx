"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

type AppThemeProviderProps = {
  children: ReactNode;
};

/** Client theme provider — dark is the default brand look. */
export default function AppThemeProvider({ children }: AppThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
