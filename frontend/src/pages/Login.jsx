import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import API from "../api/axios";
import { AuthLayout, ErrorBox, Field } from "../components/AuthLayout";
import { ArrowRightIcon, LockIcon, MailIcon, ShieldIcon } from "../components/Icons";
import { apiError } from "../utils/format";

const Login = () => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await API.post("/api/auth/login", form);
      login(res.data.user, res.data.token);
      navigate("/dashboard");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to access your dashboard, short links and analytics."
      footer={
        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <ShieldIcon className="h-3.5 w-3.5 text-emerald-600" />
          Passwords are stored as salted bcrypt hashes
        </p>
      }
    >
      <ErrorBox>{error}</ErrorBox>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          id="email"
          label="Email address"
          icon={MailIcon}
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="you@company.com"
          autoComplete="email"
          required
        />
        <Field
          id="password"
          label="Password"
          icon={LockIcon}
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
        <button type="submit" disabled={loading} className="btn-primary mt-2 h-11 w-full">
          {loading ? "Signing in…" : "Sign in"}
          {!loading && <ArrowRightIcon className="h-4 w-4" />}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Don't have an account?{" "}
        <Link to="/register" className="font-medium text-brand hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Login;
