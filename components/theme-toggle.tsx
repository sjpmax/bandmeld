"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

function readTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return "system";
}

function applyTheme(theme: Theme) {
  const html = document.documentElement;
  const sys = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && sys);
  html.classList.toggle("dark", dark);
  if (theme === "system") localStorage.removeItem("theme");
  else localStorage.setItem("theme", theme);
}

const LABEL: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "Auto",
};
const NEXT: Record<Theme, Theme> = {
  light: "dark",
  dark: "system",
  system: "light",
};
const ICON: Record<Theme, string> = {
  light: "☀",
  dark: "☾",
  system: "⌾",
};

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(readTheme());
    setMounted(true);
  }, []);

  // Re-apply when OS theme changes while on "system".
  useEffect(() => {
    if (!mounted) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => theme === "system" && applyTheme("system");
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, [mounted, theme]);

  function cycle() {
    const next = NEXT[theme];
    setTheme(next);
    applyTheme(next);
  }

  // Render a stable placeholder on the server to avoid a hydration mismatch.
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Theme"
        className="rounded-full border border-black/15 px-3 py-1 text-xs opacity-70 dark:border-white/20"
      >
        ⌾
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Theme: ${LABEL[theme]} (click to change)`}
      title={`Theme: ${LABEL[theme]}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-black/15 px-3 py-1 text-xs opacity-70 hover:opacity-100 dark:border-white/20"
    >
      <span aria-hidden>{ICON[theme]}</span>
      <span>{LABEL[theme]}</span>
    </button>
  );
}
