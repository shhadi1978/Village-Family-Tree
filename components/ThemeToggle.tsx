"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      className={`p-2 rounded-lg transition text-slate-400 hover:text-white hover:bg-slate-700 dark:hover:bg-slate-700 ${className}`}
      title={theme === "dark" ? "تبديل إلى الوضع الفاتح" : "تبديل إلى الوضع المظلم"}
      aria-label="تبديل الوضع"
    >
      {theme === "dark" ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5 text-slate-600" />
      )}
    </button>
  );
}
