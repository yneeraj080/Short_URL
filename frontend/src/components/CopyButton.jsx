import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "./Icons";

// navigator.clipboard only exists on HTTPS or localhost. The deployed site is
// plain HTTP, so fall back to the older select-and-execCommand approach there.
const copyText = async (text) => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
};

// Copy trigger: switches to an emerald check + "Copied!" for 2 seconds.
const CopyButton = ({ text, label = "Copy", className = "", compact = false }) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleCopy = async () => {
    try {
      if (!(await copyText(text))) return;
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Copy blocked by the browser; the link text can still be selected by hand.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied!" : `Copy ${text}`}
      className={
        compact
          ? `inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium transition ${
              copied ? "text-emerald-600" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            } ${className}`
          : `btn-secondary ${copied ? "!border-emerald-200 !bg-emerald-50 !text-emerald-700" : ""} ${className}`
      }
    >
      {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
      <span>{copied ? "Copied!" : label}</span>
    </button>
  );
};

export default CopyButton;
