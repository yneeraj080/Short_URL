import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "./Icons";

// Centered card on a dotted canvas, used by Sign in and Register.
export const AuthLayout = ({ title, subtitle, children, footer }) => (
  <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
    <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(rgb(var(--slate-300))_1px,transparent_1px)] [background-size:20px_20px] opacity-50" />
    <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgb(var(--canvas)/0)_0%,rgb(var(--canvas))_70%)]" />
    <div className="w-full max-w-md">
      <div className="card p-6 shadow-float sm:p-8">
        <div className="mb-7 text-center">
          <img src="/favicon.svg" alt="" className="mx-auto h-12 w-12" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>
        </div>
        {children}
      </div>
      {footer}
    </div>
  </div>
);

// Input with a leading icon; password inputs get a show/hide toggle.
export const Field = ({ label, icon: IconCmp, type = "text", id, ...props }) => {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-surface px-3.5 transition focus-within:border-brand focus-within:shadow-focus">
        {IconCmp && <IconCmp className="h-4 w-4 shrink-0 text-slate-400" />}
        <input
          id={id}
          type={isPassword && visible ? "text" : type}
          className="h-full w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="text-slate-400 hover:text-slate-600"
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
};

export const ErrorBox = ({ children }) =>
  children ? (
    <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
      {children}
    </div>
  ) : null;

// 0–4 score: length ≥ 6 (backend minimum), length ≥ 10, mixed case, digit/symbol.
export const passwordScore = (pw) => {
  if (!pw) return 0;
  let score = pw.length >= 6 ? 1 : 0;
  if (pw.length >= 10) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return score;
};

export const StrengthMeter = ({ password }) => {
  if (!password) return null;
  const score = passwordScore(password);
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
  const colors = ["bg-red-500", "bg-amber-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-600"];
  const text = ["text-red-600", "text-amber-600", "text-amber-600", "text-emerald-600", "text-emerald-700"];
  return (
    <div className="mt-2 flex items-center gap-3">
      <div className="grid flex-1 grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-1.5 rounded-full ${i <= score ? colors[score] : "bg-slate-200"}`} />
        ))}
      </div>
      <span className={`text-xs font-semibold ${text[score]}`}>{labels[score]}</span>
    </div>
  );
};
