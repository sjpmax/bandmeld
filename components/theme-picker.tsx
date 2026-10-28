"use client";

import { useEffect, useState } from "react";

type ThemeName = "default" | "memphis" | "comic" | "xp" | "deco";
const THEMES: { id: ThemeName; label: string }[] = [
  { id: "default", label: "Default" },
  { id: "memphis", label: "Memphis" },
  { id: "comic", label: "Comic" },
  { id: "xp", label: "Windows XP" },
  { id: "deco", label: "Art Deco" },
];

/** Hidden theme picker. A tiny 5x5 diamond at the bottom-right of the
 * screen toggles the picker. Writes `theme-name` to localStorage and
 * sets `data-theme` on <html>. The initial value is already applied by
 * the no-flash script in root layout, so we just mirror it here. */
export function ThemePicker() {
  const [theme, setTheme] = useState<ThemeName>("default");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") as ThemeName) || "default";
    setTheme(current);
  }, []);

  function pick(next: ThemeName) {
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme-name", next);
    } catch {}
    setTheme(next);
  }

  return (
    <>
      <button
        type="button"
        className="theme-picker-toggle"
        aria-label="Toggle theme picker"
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div className="theme-picker">
          <label htmlFor="theme-picker-select">Theme</label>
          <select
            id="theme-picker-select"
            value={theme}
            onChange={(e) => pick(e.target.value as ThemeName)}
          >
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}
