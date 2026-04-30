"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "qrio_theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  // We assume the inline boot script (in <head>) has already added the right
  // class to <html>; we just sync our React state to it on mount.
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setThemeState(isDark ? "dark" : "light");
    setMounted(true);
  }, []);

  function applyTheme(t: Theme) {
    const root = document.documentElement;
    if (t === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try { localStorage.setItem(STORAGE_KEY, t); } catch { /* private mode etc. */ }
    setThemeState(t);
  }

  function toggle() { applyTheme(theme === "dark" ? "light" : "dark"); }

  // Avoid SSR/CSR mismatch flashes for downstream consumers — children render
  // either way, but useTheme() consumers can choose to gate on `mounted`.
  return (
    <ThemeContext.Provider value={{ theme, setTheme: applyTheme, toggle }}>
      {mounted ? children : <div style={{ visibility: "hidden" }}>{children}</div>}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}

/**
 * Inline script body — injected into <head> via Next's <Script> so the right
 * theme is applied BEFORE the first paint, eliminating the flash of wrong theme.
 */
export const themeBootScript = `(function(){try{var t=localStorage.getItem('qrio_theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=t==='dark'||(!t&&m);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;
