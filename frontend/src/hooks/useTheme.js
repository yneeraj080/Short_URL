import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "theme";

const readSaved = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const systemPrefersDark = () =>
  window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;

// The initial class is set by a small script in public/index.html before
// React loads, so the page never flashes the wrong theme.
export const useTheme = () => {
  const [theme, setTheme] = useState(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light"
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Keep every toggle (desktop + mobile navbar) in sync with the <html> class.
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() =>
      setTheme(root.classList.contains("dark") ? "dark" : "light")
    );
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Follow the OS setting until the user picks a theme themselves.
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    const onChange = () => {
      if (!readSaved()) setTheme(systemPrefersDark() ? "dark" : "light");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // storage blocked (private mode): the theme still applies for this visit
      }
      return next;
    });
  }, []);

  return { theme, toggleTheme };
};
