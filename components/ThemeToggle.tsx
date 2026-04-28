"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

/**
 * Self-contained theme toggle — reads/writes directly to DOM and localStorage.
 * Does NOT depend on ThemeProvider/context, so it works reliably in dev and prod.
 */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [isDark, setIsDark] = useState(true);

  // Sync initial state from DOM (set by the inline script in layout.tsx)
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !isDark;
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
    setIsDark(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`p-2 rounded-lg transition ${className}`}
      title={isDark ? "تبديل إلى الوضع الفاتح" : "تبديل إلى الوضع المظلم"}
      aria-label="تبديل الوضع"
    >
      {isDark ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
}
