"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";

export default function ThemeSwitcher() {
  const t = useTranslations("common");
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = !mounted || resolvedTheme !== "light";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={t("theme")}
    >
      <span className={`theme-option ${isDark ? "theme-option-active" : ""}`}>
        <Moon size={14} />
        {t("dark")}
      </span>
      <span className={`theme-option ${!isDark ? "theme-option-active" : ""}`}>
        <Sun size={14} />
        {t("light")}
      </span>
    </button>
  );
}
