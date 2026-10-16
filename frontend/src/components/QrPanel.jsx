import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import API from "../api/axios";
import { DownloadIcon, XIcon } from "./Icons";
import { SHORT_HOST } from "../utils/format";

// Full-screen enlarged QR, opened by clicking a QR code (like a photo viewer).
const QrZoom = ({ qr, code, target, onClose }) => {
  useEffect(() => {
    // Capture phase + stopImmediatePropagation so Esc closes only this view,
    // not a QR modal underneath that also listens for Esc.
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  // Portal to <body>: a parent with backdrop-filter (the QR modal) would
  // otherwise trap this fixed overlay inside its own box.
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex animate-fade-in cursor-zoom-out flex-col items-center justify-center gap-5 bg-slate-950/85 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Enlarged QR code for ${code}`}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
        aria-label="Close"
      >
        <XIcon className="h-6 w-6" />
      </button>

      <div className="animate-zoom-in rounded-3xl bg-white p-4 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <img
          src={qr}
          alt={`QR code for ${code}`}
          className="block h-auto w-[min(80vw,70vh,560px)]"
          style={{ imageRendering: "pixelated" }}
        />
      </div>

      <div className="flex flex-col items-center gap-3 text-center" onClick={(e) => e.stopPropagation()}>
        <p className="font-mono text-sm text-white">
          {target === "original" ? "Original URL" : `${SHORT_HOST}/${code}`}
        </p>
        <p className="text-xs text-white/70">Point your phone camera at the code to scan it</p>
        <a href={qr} download={`snipqr-${code}.png`} className="btn bg-white text-[#0f172a] hover:bg-[#f1f5f9]">
          <DownloadIcon className="h-4 w-4" />
          Download PNG
        </a>
      </div>
    </div>,
    document.body
  );
};

// Fetches and shows the QR code for a short link, with a PNG download.
// `target` = "short" (QR of the short link, tracks scans) or "original".
const QrPanel = ({ code, target = "short", size = "h-48 w-48" }) => {
  const [qr, setQr] = useState(null);
  const [error, setError] = useState("");
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setQr(null);
    setError("");
    const path = target === "original" ? `/api/qr/original/${code}` : `/api/qr/${code}`;
    API.get(path)
      .then((res) => !cancelled && setQr(res.data.qr))
      .catch(() => !cancelled && setError("Couldn't generate the QR code."));
    return () => {
      cancelled = true;
    };
  }, [code, target]);

  return (
    <div className="flex flex-col items-center gap-3">
      {qr ? (
        <button
          type="button"
          onClick={() => setZoomed(true)}
          className={`${size} group relative flex cursor-zoom-in items-center justify-center rounded-xl border border-slate-200 bg-white p-2 transition hover:border-brand/40 hover:shadow-card-hover focus:outline-none focus-visible:shadow-focus`}
          title="Click to enlarge"
          aria-label={`Enlarge QR code for ${code}`}
        >
          <img src={qr} alt={`QR code for ${code}`} className="h-full w-full" style={{ imageRendering: "pixelated" }} />
          <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded-md bg-slate-900/75 px-1.5 py-0.5 text-[10px] font-semibold text-surface opacity-0 transition group-hover:opacity-100">
            Click to enlarge
          </span>
        </button>
      ) : (
        <div className={`${size} flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2`}>
          {error ? (
            <p className="px-3 text-center text-xs text-red-600">{error}</p>
          ) : (
            <div className="h-full w-full animate-pulse rounded-lg bg-slate-100" />
          )}
        </div>
      )}
      {qr && (
        <a href={qr} download={`snipqr-${code}.png`} className="btn-secondary !py-2 text-xs">
          <DownloadIcon className="h-4 w-4" />
          Download PNG
        </a>
      )}
      {zoomed && qr && <QrZoom qr={qr} code={code} target={target} onClose={() => setZoomed(false)} />}
    </div>
  );
};

export default QrPanel;
