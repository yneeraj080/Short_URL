import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import API from "../api/axios";
import { Field, StrengthMeter } from "../components/AuthLayout";
import { ChartIcon, LinkIcon, LockIcon, LogoutIcon, MailIcon, ShieldIcon, UserIcon } from "../components/Icons";
import { apiError } from "../utils/format";

const EMPTY = { currentPassword: "", newPassword: "", confirmPassword: "" };

const Profile = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  if (!user) return null;

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    if (form.newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await API.put("/api/auth/change-password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setMessage("Password changed successfully.");
      setForm(EMPTY);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const mismatch = form.confirmPassword && form.newPassword !== form.confirmPassword;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      {/* Identity header */}
      <section className="card relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-brand-active text-3xl font-bold text-white shadow-card-hover">
              {user.name?.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{user.name}</h1>
              <p className="mt-1 flex items-center gap-1.5 truncate font-mono text-sm text-slate-500">
                <MailIcon className="h-4 w-4 shrink-0" />
                {user.email}
              </p>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-danger self-start sm:self-auto">
            <LogoutIcon className="h-4 w-4" />
            Log out
          </button>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Personal details */}
        <section className="card p-6 lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">Personal details</h2>
              <p className="text-sm text-slate-500">The name and email on your account.</p>
            </div>
            <span className="badge rounded-md bg-brand-soft font-mono text-brand">
              ID {String(user.id).slice(-6)}
            </span>
          </div>
          <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <UserIcon className="h-3.5 w-3.5" /> Full name
              </dt>
              <dd className="mt-1 truncate text-sm font-medium text-slate-900">{user.name}</dd>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <MailIcon className="h-3.5 w-3.5" /> Email address
              </dt>
              <dd className="mt-1 truncate text-sm font-medium text-slate-900">{user.email}</dd>
            </div>
          </dl>
        </section>

        {/* Shortcuts */}
        <section className="card p-6">
          <h2 className="text-lg font-semibold">Shortcuts</h2>
          <div className="mt-4 flex flex-col gap-2">
            <Link to="/dashboard" className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium transition hover:border-slate-300 hover:bg-slate-50">
              <ChartIcon className="h-4 w-4 text-brand" /> My links &amp; analytics
            </Link>
            <Link to="/" className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium transition hover:border-slate-300 hover:bg-slate-50">
              <LinkIcon className="h-4 w-4 text-brand" /> Create a short link
            </Link>
          </div>
        </section>

        {/* Change password */}
        <section className="card p-6 lg:col-span-2">
          <div className="flex items-center gap-2">
            <ShieldIcon className="h-5 w-5 text-brand" />
            <h2 className="text-lg font-semibold">Change password</h2>
          </div>
          <p className="text-sm text-slate-500">Use at least 6 characters. A longer password is stronger.</p>

          {message && (
            <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700" role="status">
              {message}
            </div>
          )}
          {error && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="mt-5 flex flex-col gap-4">
            <Field
              id="currentPassword"
              label="Current password"
              icon={LockIcon}
              type="password"
              name="currentPassword"
              value={form.currentPassword}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Field
                  id="newPassword"
                  label="New password"
                  icon={LockIcon}
                  type="password"
                  name="newPassword"
                  value={form.newPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                  required
                />
                <StrengthMeter password={form.newPassword} />
              </div>
              <div>
                <Field
                  id="confirmPassword"
                  label="Confirm new password"
                  icon={LockIcon}
                  type="password"
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                  required
                />
                {mismatch && <p className="mt-2 text-xs font-medium text-red-600">Passwords don't match</p>}
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? "Saving…" : "Update password"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default Profile;
