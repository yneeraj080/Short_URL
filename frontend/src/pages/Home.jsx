import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import API from "../api/axios";
import CopyButton from "../components/CopyButton";
import QrPanel from "../components/QrPanel";
import {
  ActivityIcon,
  ArrowRightIcon,
  BoltIcon,
  ChevronDownIcon,
  ExternalIcon,
  LinkIcon,
  QrIcon,
  SearchIcon,
  ShieldIcon,
  SlidersIcon,
  XIcon,
} from "../components/Icons";
import { SHORT_HOST, apiError, formatDate } from "../utils/format";

const EXPIRY_OPTIONS = [
  ["", "30 days (default)"],
  ["1", "1 day"],
  ["7", "7 days"],
  ["90", "90 days"],
  ["365", "1 year"],
];

const FEATURES = [
  {
    icon: BoltIcon,
    title: "Cached redirects",
    text: "Popular links are served from a Redis cache, so redirects skip the database.",
  },
  {
    icon: ActivityIcon,
    title: "Click analytics",
    text: "Every click records its browser, device and OS without slowing the redirect down.",
  },
  {
    icon: QrIcon,
    title: "QR for every link",
    text: "Each short link gets a downloadable QR code. Scans count as clicks.",
  },
];

const Home = () => {
  const [url, setUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [expiresIn, setExpiresIn] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [lookup, setLookup] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();

  const handleShorten = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate("/login");
      return;
    }
    if (!url.trim()) {
      setError("Paste a URL to shorten.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await API.post("/api/shorten", {
        originalUrl: url.trim(),
        alias: alias.trim() || undefined,
        expiresIn: expiresIn || undefined,
      });
      setResult(res.data);
      setAlias("");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = async (e) => {
    e.preventDefault();
    const code = lookup.trim().replace(/\/+$/, "").split("/").pop();
    if (!code) return;
    setLookupResult(null);
    setLookupLoading(true);
    try {
      const res = await API.get(`/api/lookup/${encodeURIComponent(code)}`);
      setLookupResult({ code, ...res.data });
    } catch (err) {
      setLookupResult({
        error: err.response?.status === 410 ? "This short link has expired." : "No short link found for that code.",
      });
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* soft background glow */}
      <div className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[32rem] bg-[radial-gradient(ellipse_at_top,rgba(79,70,229,0.10),transparent_60%)]" />

      <div className="mx-auto max-w-4xl px-4 pb-20 pt-14 sm:px-6 sm:pt-20">
        {/* Hero */}
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            Short links · QR codes · Analytics
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tightest text-slate-900 sm:text-5xl sm:leading-[1.15]">
            Shorten links. Generate QR codes.{" "}
            <span className="text-brand">Track everything.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-600 sm:text-lg">
            A clean URL shortener and QR generator with click analytics for every link you share.
          </p>
        </div>

        {/* Shorten card */}
        <form onSubmit={handleShorten} className="card mt-10 p-4 shadow-float sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-surface px-3.5 transition focus-within:border-brand focus-within:shadow-focus">
              <LinkIcon className="h-5 w-5 shrink-0 text-slate-400" />
              <input
                type="text"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste a long URL, e.g. https://example.com/a/very/long/link"
                className="h-12 w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                aria-label="URL to shorten"
              />
              {url && (
                <button type="button" onClick={() => setUrl("")} className="text-slate-400 hover:text-slate-600" aria-label="Clear URL">
                  <XIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            <button type="submit" disabled={loading} className="btn-primary h-12 px-6">
              <BoltIcon className="h-4 w-4" />
              {loading ? "Shortening…" : user ? "Shorten & Generate QR" : "Sign in to shorten"}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowOptions(!showOptions)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-brand"
              aria-expanded={showOptions}
            >
              <SlidersIcon className="h-4 w-4" />
              Custom alias &amp; expiry
              <ChevronDownIcon className={`h-3.5 w-3.5 transition ${showOptions ? "rotate-180" : ""}`} />
            </button>
            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
              <ShieldIcon className="h-3.5 w-3.5 text-emerald-500" />
              Links are tied to your account
            </span>
          </div>

          {showOptions && (
            <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 md:grid-cols-2">
              <div>
                <label className="label" htmlFor="alias">Custom alias</label>
                <div className="flex h-11 items-center overflow-hidden rounded-lg border border-slate-200 bg-surface transition focus-within:border-brand focus-within:shadow-focus">
                  <span className="border-r border-slate-200 bg-slate-50 px-3 py-3 font-mono text-xs text-slate-500">
                    {SHORT_HOST}/
                  </span>
                  <input
                    id="alias"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                    placeholder="summer25"
                    maxLength={20}
                    className="h-full w-full bg-transparent px-3 font-mono text-sm focus:outline-none"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">3–20 letters or numbers. Leave empty for a random code.</p>
              </div>
              <div>
                <label className="label" htmlFor="expires">Expires after</label>
                <select id="expires" value={expiresIn} onChange={(e) => setExpiresIn(e.target.value)} className="input">
                  {EXPIRY_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-4 flex flex-col gap-5 rounded-xl border border-brand/15 bg-brand-soft/60 p-4 sm:flex-row sm:items-center">
              <QrPanel code={result.shortCode} size="h-32 w-32" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge bg-emerald-50 text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                  <span className="badge rounded-md bg-surface font-mono text-slate-500">302 redirect</span>
                </div>
                <a
                  href={result.shortUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block truncate font-mono text-lg font-semibold text-brand hover:underline"
                >
                  {result.shortUrl}
                </a>
                <p className="mt-1 truncate font-mono text-xs text-slate-500" title={result.originalUrl}>
                  → {result.originalUrl}
                </p>
                <p className="mt-1 text-xs text-slate-400">Expires {formatDate(result.expiresAt)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <CopyButton text={result.shortUrl} label="Copy link" />
                  <Link to={`/analytics/${result.shortCode}`} className="btn-ghost">
                    View analytics
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Reverse lookup */}
        <section className="card mt-8 p-5 sm:p-6">
          <p className="eyebrow">Safety check</p>
          <h2 className="mt-1 text-xl font-semibold">Reverse lookup</h2>
          <p className="mt-1 text-sm text-slate-500">
            See where a short link goes before you open it.
          </p>
          <form onSubmit={handleLookup} className="mt-4 flex flex-col gap-3 md:flex-row">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-surface px-3.5 transition focus-within:border-brand focus-within:shadow-focus">
              <SearchIcon className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                value={lookup}
                onChange={(e) => setLookup(e.target.value)}
                placeholder={`${SHORT_HOST}/abc123 or just abc123`}
                className="h-11 w-full bg-transparent font-mono text-sm placeholder:text-slate-400 focus:outline-none"
                aria-label="Short URL or code"
              />
            </div>
            <button type="submit" disabled={lookupLoading || !lookup.trim()} className="btn bg-slate-900 text-surface hover:bg-slate-700">
              {lookupLoading ? "Looking up…" : "Look up destination"}
            </button>
          </form>

          {lookupResult &&
            (lookupResult.error ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {lookupResult.error}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ShieldIcon className="h-4 w-4 text-emerald-600" />
                  Destination found
                  <span className="slug ml-1">{lookupResult.code}</span>
                </div>
                <div className="mt-3 flex flex-col gap-2 rounded-lg border border-slate-200 bg-surface p-3 sm:flex-row sm:items-center">
                  <p className="min-w-0 flex-1 break-all font-mono text-xs text-slate-600">
                    {lookupResult.originalUrl}
                  </p>
                  <a href={lookupResult.originalUrl} target="_blank" rel="noreferrer noopener" className="btn-ghost shrink-0 !py-1.5 text-brand">
                    Visit site
                    <ExternalIcon className="h-4 w-4" />
                  </a>
                </div>
              </div>
            ))}
        </section>

        {/* Features */}
        <section className="mt-16">
          <h2 className="text-center text-2xl font-bold tracking-tight">Built for speed</h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-sm text-slate-500">
            Fast redirects and analytics that don't get in the way.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {FEATURES.map(({ icon: IconCmp, title, text }) => (
              <div key={title} className="card p-5 transition hover:border-slate-300 hover:shadow-card-hover">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <IconCmp className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Home;
