import { useEffect, useState } from "react";
import QrPanel from "./QrPanel";
import { XIcon } from "./Icons";
import { SHORT_HOST } from "../utils/format";

const QrModal = ({ code, onClose }) => {
  const [target, setTarget] = useState("short");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`QR code for ${code}`}
    >
      <div className="card w-full max-w-sm p-6 shadow-float" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">QR code</h3>
            <p className="mt-0.5 font-mono text-xs text-slate-500">
              {SHORT_HOST}/{code}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost !p-1.5" aria-label="Close">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-xs font-semibold">
          {[
            ["short", "Short link (tracked)"],
            ["original", "Original URL"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTarget(value)}
              className={`rounded-md px-2 py-1.5 transition ${
                target === value ? "bg-surface text-slate-900 shadow-card" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <QrPanel code={code} target={target} size="h-56 w-56" />

        <p className="mt-4 text-center text-xs text-slate-500">
          {target === "short"
            ? "Scans go through your short link, so they count as clicks."
            : "Scans go straight to the destination and aren't tracked."}
        </p>
      </div>
    </div>
  );
};

export default QrModal;
