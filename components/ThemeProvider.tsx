"use client";

import { createContext, useContext, useLayoutEffect, useState } from "react";

type Theme = "dark" | "light";

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
}>({ theme: "dark", toggle: () => {} });

function applyTheme(t: Theme) {
  if (typeof window === "undefined") return;
  if (t === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Read from localStorage on first render (most reliable source).
  // Falls back to DOM class set by the inline script in layout.tsx.
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem("theme") as Theme | null;
    if (saved === "light" || saved === "dark") return saved;
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  });

  // Keep the DOM in sync with state synchronously before every paint.
  // Using useLayoutEffect with [theme] dependency means this fires after
  // every render where theme changed — including React Strict Mode's double-invocation.
  // This makes the toggle reliable in dev mode.
  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
