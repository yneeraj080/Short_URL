import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import API from "../api/axios";
import CopyButton from "../components/CopyButton";
import QrModal from "../components/QrModal";
import StatCard from "../components/StatCard";
import {
  ActivityIcon,
  ArrowLeftIcon,
  CalendarIcon,
  ChartIcon,
  ClockIcon,
  DownloadIcon,
  LinkIcon,
  QrIcon,
} from "../components/Icons";
import {
  SHORT_HOST,
  apiError,
  formatDate,
  formatDateTime,
  formatNumber,
  isExpired,
  shortUrlFor,
} from "../utils/format";

const RANGES = [7, 30, 90];
const SAMPLE_LIMIT = 1000; // the API returns at most this many recent clicks
const DAY = 86400000;

const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
};

// Clicks per calendar day for the last `days` days (oldest first).
const buildDaily = (events, days) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = [];
  const index = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today.getTime() - i * DAY);
    index.set(dayKey(date), buckets.length);
    buckets.push({ date, count: 0 });
  }
  events.forEach((e) => {
    const i = index.get(dayKey(e.clickedAt));
    if (i !== undefined) buckets[i].count += 1;
  });
  return buckets;
};

// The UA parser reports device types in lowercase ("mobile", "tablet").
const label = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : "Unknown");

const countBy = (events, field) => {
  const counts = {};
  events.forEach((e) => {
    // Only device types need capitalising; "iOS" / "macOS" must stay as-is.
    const key = field === "device" ? label(e[field]) : e[field] || "Unknown";
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
};

// Round the axis max up to a "nice" number (1, 2, 5 × 10^n).
const niceMax = (value) => {
  if (value <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((s) => s * pow >= value / 1);
  return step * pow;
};

const ClicksChart = ({ daily }) => {
  const [hover, setHover] = useState(null);
  const max = niceMax(Math.max(...daily.map((d) => d.count)));
  const ticks = [max, max / 2, 0];
  const labelEvery = daily.length <= 7 ? 1 : daily.length <= 30 ? 5 : 15;
  const peak = daily.reduce((best, d, i) => (d.count > daily[best].count ? i : best), 0);

  return (
    <div className="relative">
      <div className="flex">
        {/* y axis */}
        <div className="flex h-56 w-10 shrink-0 flex-col justify-between pr-2 text-right font-mono text-[10px] text-slate-400">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 last:translate-y-1/2">{formatNumber(t)}</span>
          ))}
        </div>
        {/* plot */}
        <div className="relative h-56 flex-1">
          {ticks.map((t, i) => (
            <div
              key={t}
              className={`absolute inset-x-0 border-t ${i === ticks.length - 1 ? "border-slate-300" : "border-dashed border-slate-200"}`}
              style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
            />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
            {daily.map((d, i) => (
              <div
                key={i}
                className="group relative flex h-full flex-1 cursor-default items-end"
                onMouseEnter={() => setHover(i)}
                aria-label={`${formatDate(d.date)}: ${d.count} clicks`}
                role="img"
              >
                <div
                  className={`w-full rounded-t-[4px] transition-colors ${
                    hover === i ? "bg-brand-active" : d.count ? "bg-brand" : "bg-transparent"
                  }`}
                  style={{ height: d.count ? `max(${(d.count / max) * 100}%, 3px)` : 0 }}
                />
              </div>
            ))}
          </div>

          {hover !== null && (
            <div
              className={`pointer-events-none absolute -top-2 z-10 -translate-y-full whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 font-mono text-[11px] text-surface shadow-float ${
                // keep the tooltip inside the card near either edge
                hover < daily.length * 0.15 ? "" : hover > daily.length * 0.85 ? "-translate-x-full" : "-translate-x-1/2"
              }`}
              style={{ left: `${((hover + 0.5) / daily.length) * 100}%` }}
            >
              {formatDate(daily[hover].date)} · <span className="font-semibold">{formatNumber(daily[hover].count)}</span>{" "}
              {daily[hover].count === 1 ? "click" : "clicks"}
            </div>
          )}
        </div>
      </div>
      {/* x axis */}
      <div className="ml-10 mt-2 flex gap-[2px] font-mono text-[10px] text-slate-400">
        {daily.map((d, i) => (
          <span key={i} className="flex flex-1 justify-center whitespace-nowrap">
            {(daily.length - 1 - i) % labelEvery === 0
              ? d.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
              : ""}
          </span>
        ))}
      </div>
      {daily[peak].count > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          Busiest day: <span className="font-medium text-slate-700">{formatDate(daily[peak].date)}</span> with{" "}
          <span className="tabular font-medium text-slate-700">{formatNumber(daily[peak].count)}</span> clicks
        </p>
      )}
    </div>
  );
};

const Breakdown = ({ title, subtitle, rows, total }) => (
  <div className="card p-5">
    <h3 className="font-semibold">{title}</h3>
    <p className="text-xs text-slate-500">{subtitle}</p>
    {rows.length === 0 ? (
      <p className="mt-6 text-sm text-slate-400">No data in this range.</p>
    ) : (
      <ul className="mt-5 space-y-3.5">
        {rows.slice(0, 6).map(([name, count]) => {
          const pct = (count / total) * 100;
          return (
            <li key={name}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate text-slate-700">{name}</span>
                <span className="tabular shrink-0 font-mono text-xs text-slate-500">
                  {formatNumber(count)} · <span className="font-semibold text-slate-900">{pct.toFixed(pct < 10 ? 1 : 0)}%</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-brand" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
        {rows.length > 6 && (
          <li className="text-xs text-slate-400">+ {rows.length - 6} more</li>
        )}
      </ul>
    )}
  </div>
);

const exportCsv = (code, events) => {
  const rows = [["clickedAt", "browser", "device", "os"], ...events.map((e) => [new Date(e.clickedAt).toISOString(), e.browser, label(e.device), e.os])];
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `snipqr-${code}-clicks.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const Analytics = () => {
  const { code } = useParams();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState(30);
  const [showQr, setShowQr] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    setLoading(true);
    API.get(`/api/stats/${code}`)
      .then((res) => setStats(res.data))
      .catch((err) =>
        setError(err.response?.status === 404 ? "This link doesn't exist or isn't yours." : apiError(err))
      )
      .finally(() => setLoading(false));
  }, [user, code, navigate]);

  const inRange = useMemo(() => {
    if (!stats) return [];
    const since = Date.now() - range * DAY;
    return stats.analytics.filter((e) => new Date(e.clickedAt).getTime() >= since);
  }, [stats, range]);

  const daily = useMemo(() => buildDaily(inRange, range), [inRange, range]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="card h-32 animate-pulse" />
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="card h-28 animate-pulse" />)}
        </div>
        <div className="card mt-6 h-80 animate-pulse" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <ChartIcon />
        </span>
        <h1 className="mt-4 text-xl font-semibold">Analytics unavailable</h1>
        <p className="mt-1 text-sm text-slate-500">{error || "Link not found."}</p>
        <Link to="/dashboard" className="btn-primary mt-6">
          <ArrowLeftIcon className="h-4 w-4" />
          Back to dashboard
        </Link>
      </div>
    );
  }

  const expired = isExpired(stats.expiresAt);
  const shortUrl = shortUrlFor(stats.shortCode);
  const lastClick = stats.analytics.length ? stats.analytics[stats.analytics.length - 1].clickedAt : null;
  const sampled = stats.clicks > stats.analytics.length && stats.analytics.length >= SAMPLE_LIMIT;
  const recent = inRange.slice(-15).reverse();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-2 font-mono text-xs text-slate-500">
        <Link to="/dashboard" className="hover:text-brand">Dashboard</Link>
        <span>/</span>
        <span className="slug">{SHORT_HOST}/{stats.shortCode}</span>
        <span>/</span>
        <span className="text-brand">Analytics</span>
      </nav>

      {/* Header */}
      <section className="card mt-4 flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand sm:flex">
            <LinkIcon />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <a href={shortUrl} target="_blank" rel="noreferrer" className="font-mono text-lg font-semibold text-brand hover:underline">
                {shortUrl}
              </a>
              <CopyButton text={shortUrl} compact />
              {expired ? (
                <span className="badge bg-slate-100 text-slate-500">Expired</span>
              ) : (
                <span className="badge bg-emerald-50 text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-sm text-slate-500" title={stats.originalUrl}>→ {stats.originalUrl}</p>
            <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5" /> Created {formatDate(stats.createdAt)}</span>
              <span className="inline-flex items-center gap-1"><ClockIcon className="h-3.5 w-3.5" /> {expired ? "Expired" : "Expires"} {formatDate(stats.expiresAt)}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowQr(true)} className="btn-secondary">
            <QrIcon className="h-4 w-4" />
            QR code
          </button>
          <button onClick={() => exportCsv(stats.shortCode, inRange)} disabled={inRange.length === 0} className="btn-secondary">
            <DownloadIcon className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </section>

      {/* Range selector */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-surface p-0.5 text-sm font-medium shadow-card">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-3 py-1.5 transition ${
                range === r ? "bg-brand-soft text-brand" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Last {r} days
            </button>
          ))}
        </div>
        {sampled && (
          <p className="text-xs text-slate-500">
            Charts use the latest {formatNumber(SAMPLE_LIMIT)} of {formatNumber(stats.clicks)} clicks.
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total clicks" value={formatNumber(stats.clicks)} icon={ActivityIcon} hint="All time" />
        <StatCard label={`Last ${range} days`} value={formatNumber(inRange.length)} icon={ChartIcon} tone="sky" hint={sampled ? "From recent sample" : "Clicks in range"} />
        <StatCard
          label="Daily average"
          value={(inRange.length / range).toFixed(inRange.length / range < 10 ? 1 : 0)}
          icon={CalendarIcon}
          tone="emerald"
          hint={`Over ${range} days`}
        />
        <StatCard label="Last click" value={lastClick ? formatDate(lastClick) : "—"} icon={ClockIcon} tone="slate" hint={lastClick ? formatDateTime(lastClick) : "No clicks yet"} />
      </div>

      {stats.analytics.length === 0 ? (
        <div className="card mt-6 flex flex-col items-center px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand"><ActivityIcon /></span>
          <h3 className="mt-4 font-semibold">No clicks yet</h3>
          <p className="mt-1 text-sm text-slate-500">Share your link or QR code to start collecting analytics.</p>
          <div className="mt-5"><CopyButton text={shortUrl} label="Copy short link" /></div>
        </div>
      ) : (
        <>
          {/* Clicks over time */}
          <section className="card mt-6 p-5 sm:p-6">
            <h2 className="font-semibold">Clicks over time</h2>
            <p className="mb-6 text-xs text-slate-500">Daily clicks for the last {range} days</p>
            <ClicksChart daily={daily} />
          </section>

          {/* Breakdowns */}
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Breakdown title="Browsers" subtitle="Client browser" rows={countBy(inRange, "browser")} total={inRange.length} />
            <Breakdown title="Devices" subtitle="Device type" rows={countBy(inRange, "device")} total={inRange.length} />
            <Breakdown title="Operating systems" subtitle="Host OS" rows={countBy(inRange, "os")} total={inRange.length} />
          </div>

          {/* Recent clicks */}
          <section className="card mt-6 overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
              <h2 className="font-semibold">Recent clicks</h2>
              <p className="text-xs text-slate-500">Latest {recent.length} in the selected range</p>
            </div>
            {recent.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-slate-500">No clicks in the last {range} days.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-6 py-3">Time</th>
                      <th className="px-6 py-3">Browser</th>
                      <th className="px-6 py-3">Device</th>
                      <th className="px-6 py-3">OS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recent.map((click, i) => (
                      <tr key={click._id || i} className="hover:bg-slate-50/60">
                        <td className="tabular whitespace-nowrap px-6 py-3 font-mono text-xs text-slate-500">{formatDateTime(click.clickedAt)}</td>
                        <td className="px-6 py-3 text-slate-900">{click.browser}</td>
                        <td className="px-6 py-3 text-slate-900">{label(click.device)}</td>
                        <td className="px-6 py-3 text-slate-900">{click.os}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {showQr && <QrModal code={stats.shortCode} onClose={() => setShowQr(false)} />}
    </div>
  );
};

export default Analytics;
