"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeSwitcher() {
  const [isDark, setIsDark] = useState(true);

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setIsDark(!isDark)}
      aria-label="Toggle theme"
    >
      <span className={`theme-option ${isDark ? "theme-option-active" : ""}`}>
        <Moon size={14} />
        Dark
      </span>
      <span className={`theme-option ${!isDark ? "theme-option-active" : ""}`}>
        <Sun size={14} />
        Light
      </span>
    </button>
  );
}
