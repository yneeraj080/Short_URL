import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import API from "../api/axios";
import CopyButton from "../components/CopyButton";
import QrModal from "../components/QrModal";
import StatCard from "../components/StatCard";
import {
  ActivityIcon,
  ChartIcon,
  ClockIcon,
  ExternalIcon,
  LayersIcon,
  LinkIcon,
  PlusIcon,
  QrIcon,
  SearchIcon,
  TrashIcon,
} from "../components/Icons";
import {
  SHORT_HOST,
  apiError,
  formatDate,
  formatNumber,
  isExpired,
  relativeDays,
  shortUrlFor,
} from "../utils/format";

const PAGE_SIZE = 10;
const FILTERS = [
  ["all", "All"],
  ["active", "Active"],
  ["expired", "Expired"],
];

const Dashboard = () => {
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [qrCode, setQrCode] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    API.get("/api/urls")
      .then((res) => setUrls(res.data))
      .catch((err) => setError(apiError(err, "Couldn't load your links.")))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  const stats = useMemo(() => {
    const active = urls.filter((u) => !isExpired(u.expiresAt)).length;
    return {
      total: urls.length,
      clicks: urls.reduce((sum, u) => sum + (u.clicks || 0), 0),
      active,
      expired: urls.length - active,
    };
  }, [urls]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return urls.filter((u) => {
      const expired = isExpired(u.expiresAt);
      if (filter === "active" && expired) return false;
      if (filter === "expired" && !expired) return false;
      return !q || u.shortCode.toLowerCase().includes(q) || u.originalUrl.toLowerCase().includes(q);
    });
  }, [urls, query, filter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleDelete = async (code) => {
    setDeleting(code);
    try {
      await API.delete(`/api/urls/${code}`);
      setUrls((prev) => prev.filter((u) => u.shortCode !== code));
      setConfirmDelete(null);
    } catch (err) {
      setError(apiError(err, "Couldn't delete that link."));
    } finally {
      setDeleting(null);
    }
  };

  const closeQr = useCallback(() => setQrCode(null), []);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="h-8 w-56 animate-pulse rounded bg-slate-200" />
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card h-28 animate-pulse" />
          ))}
        </div>
        <div className="card mt-8 h-72 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Link management</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">My Links &amp; QR Codes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your short links, track clicks and download QR codes.
          </p>
        </div>
        <Link to="/" className="btn-primary self-start md:self-auto">
          <PlusIcon className="h-4 w-4" />
          New link / QR
        </Link>
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total links" value={formatNumber(stats.total)} icon={LinkIcon} />
        <StatCard label="Total clicks" value={formatNumber(stats.clicks)} icon={ActivityIcon} tone="sky" hint="Across all links" />
        <StatCard label="Active links" value={formatNumber(stats.active)} icon={LayersIcon} tone="emerald" />
        <StatCard label="Expired links" value={formatNumber(stats.expired)} icon={ClockIcon} tone="slate" />
      </div>

      {/* Link roster */}
      <section className="card mt-8 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Link roster</h2>
            <span className="badge rounded-md bg-brand-soft font-mono text-brand">
              {filtered.length} of {urls.length}
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-surface px-3 focus-within:border-brand focus-within:shadow-focus">
              <SearchIcon className="h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search code or URL"
                className="h-9 w-full bg-transparent text-sm focus:outline-none sm:w-56"
                aria-label="Search links"
              />
            </div>
            <div className="flex rounded-lg border border-slate-200 bg-surface p-0.5 text-xs font-semibold">
              {FILTERS.map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => {
                    setFilter(value);
                    setPage(1);
                  }}
                  className={`flex-1 rounded-md px-3 py-1.5 transition ${
                    filter === value ? "bg-brand-soft text-brand" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {urls.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <LinkIcon />
            </span>
            <h3 className="mt-4 font-semibold">No links yet</h3>
            <p className="mt-1 text-sm text-slate-500">Create your first short link and QR code.</p>
            <Link to="/" className="btn-primary mt-5">
              <PlusIcon className="h-4 w-4" />
              Create a link
            </Link>
          </div>
        ) : visible.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">No links match your search.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map((url) => {
              const expired = isExpired(url.expiresAt);
              const shortUrl = shortUrlFor(url.shortCode);
              return (
                <li key={url._id} className="flex flex-col gap-4 px-4 py-5 transition hover:bg-slate-50/60 sm:px-6 lg:flex-row lg:items-center">
                  {/* Identity */}
                  <div className="flex min-w-0 flex-1 gap-4">
                    <button
                      onClick={() => setQrCode(url.shortCode)}
                      className={`hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl border sm:flex ${
                        expired ? "border-slate-200 bg-slate-50 text-slate-400" : "border-brand/15 bg-brand-soft text-brand hover:bg-brand/10"
                      }`}
                      title="Show QR code"
                    >
                      <QrIcon className="h-6 w-6" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`slug ${expired ? "!bg-slate-100 !text-slate-500" : ""}`}>
                          {SHORT_HOST}/{url.shortCode}
                        </span>
                        {expired ? (
                          <span className="badge bg-slate-100 text-slate-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            Expired
                          </span>
                        ) : (
                          <span className="badge bg-emerald-50 text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        )}
                        <CopyButton text={shortUrl} compact />
                        <a href={shortUrl} target="_blank" rel="noreferrer" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Open short link">
                          <ExternalIcon className="h-4 w-4" />
                        </a>
                      </div>
                      <p className="mt-1.5 truncate text-xs text-slate-500" title={url.originalUrl}>
                        <span className="font-mono text-slate-400">Target:</span> {url.originalUrl}
                      </p>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="flex items-center gap-6 lg:gap-8">
                    <div className="text-right">
                      <p className="tabular font-mono text-sm font-semibold text-slate-900">{formatNumber(url.clicks)}</p>
                      <p className="text-xs text-slate-500">clicks</p>
                    </div>
                    <div className="w-32 text-right">
                      <p className="text-xs text-slate-400">{expired ? "Expired" : "Expires"}</p>
                      <p className="text-sm font-medium text-slate-700">{formatDate(url.expiresAt)}</p>
                      <p className="font-mono text-[11px] text-slate-400">({relativeDays(url.expiresAt)})</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Link to={`/analytics/${url.shortCode}`} className="btn !px-3 !py-2 bg-brand-soft text-brand hover:bg-brand/10">
                      <ChartIcon className="h-4 w-4" />
                      Analytics
                    </Link>
                    <button onClick={() => setQrCode(url.shortCode)} className="btn-ghost !p-2" title="QR code" aria-label="QR code">
                      <QrIcon className="h-[18px] w-[18px]" />
                    </button>
                    {confirmDelete === url.shortCode ? (
                      <span className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(url.shortCode)}
                          disabled={deleting === url.shortCode}
                          className="btn !px-2.5 !py-1.5 bg-[#dc2626] text-xs text-white hover:bg-[#b91c1c]"
                        >
                          {deleting === url.shortCode ? "Deleting…" : "Delete"}
                        </button>
                        <button onClick={() => setConfirmDelete(null)} className="btn-ghost !px-2 !py-1.5 text-xs">
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(url.shortCode)}
                        className="btn-ghost !p-2 hover:!bg-red-50 hover:!text-red-600"
                        title="Delete link"
                        aria-label="Delete link"
                      >
                        <TrashIcon className="h-[18px] w-[18px]" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-4 py-3 text-sm sm:px-6">
            <p className="text-slate-500">
              Showing <span className="font-semibold text-slate-900">{(currentPage - 1) * PAGE_SIZE + 1}</span>–
              <span className="font-semibold text-slate-900">{Math.min(currentPage * PAGE_SIZE, filtered.length)}</span> of{" "}
              <span className="font-semibold text-slate-900">{filtered.length}</span>
            </p>
            <div className="flex gap-2">
              <button className="btn-secondary !py-1.5" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                Previous
              </button>
              <button className="btn-secondary !py-1.5" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {qrCode && <QrModal code={qrCode} onClose={closeQr} />}
    </div>
  );
};

export default Dashboard;
