/** @type {import('tailwindcss').Config} */
// Design tokens from the "Kinetic Minimal SaaS" design system (Stitch export).
//
// Neutral and status colours read CSS variables (defined in src/index.css) so
// the whole UI switches theme when <html> gets the `dark` class. The slate
// scale is inverted in dark mode: text-slate-900 stays "primary ink",
// border-slate-200 stays "hairline border", and so on.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const scale = (color, steps) =>
  Object.fromEntries(steps.map((s) => [s, v(`${color}-${s}`)]));

module.exports = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        canvas: v("canvas"),
        surface: v("surface"),
        brand: {
          DEFAULT: "#4F46E5",
          hover: "#4338CA",
          active: "#3730A3",
          soft: v("brand-soft"),
        },
        slate: { ...scale("slate", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]), 950: "#020617" },
        emerald: scale("emerald", [50, 200, 500, 600, 700]),
        red: scale("red", [50, 100, 200, 500, 600, 700]),
        sky: scale("sky", [50, 600]),
        amber: scale("amber", [500, 600]),
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(15, 23, 42, 0.04)",
        "card-hover":
          "0 4px 12px -2px rgba(15, 23, 42, 0.06), 0 2px 4px -1px rgba(15, 23, 42, 0.03)",
        float:
          "0 12px 28px -4px rgba(15, 23, 42, 0.08), 0 4px 8px -2px rgba(15, 23, 42, 0.04)",
        focus: "0 0 0 3px rgba(79, 70, 229, 0.15)",
      },
      letterSpacing: {
        tightest: "-0.03em",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "zoom-in": {
          from: { opacity: "0", transform: "scale(0.6)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "zoom-in": "zoom-in 220ms cubic-bezier(0.2, 0.9, 0.3, 1.2)",
      },
    },
  },
  plugins: [],
}
