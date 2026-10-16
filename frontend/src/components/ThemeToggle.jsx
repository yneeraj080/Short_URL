import { useTheme } from "../hooks/useTheme";
import { MoonIcon, SunIcon } from "./Icons";

const ThemeToggle = ({ className = "" }) => {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-surface text-slate-600 transition hover:border-slate-300 hover:text-slate-900 focus:outline-none focus-visible:shadow-focus ${className}`}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      <SunIcon
        className={`absolute h-[18px] w-[18px] transition-all duration-300 ${
          dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
        }`}
      />
      <MoonIcon
        className={`absolute h-[18px] w-[18px] transition-all duration-300 ${
          dark ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"
        }`}
      />
    </button>
  );
};

export default ThemeToggle;
