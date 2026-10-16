import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import API from "../api/axios";
import { AuthLayout, ErrorBox, Field, StrengthMeter } from "../components/AuthLayout";
import { ArrowRightIcon, CheckIcon, LockIcon, MailIcon, UserIcon } from "../components/Icons";
import { apiError } from "../utils/format";

const PERKS = ["Unlimited short links", "QR code for every link", "Click analytics"];

const Register = () => {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await API.post("/api/auth/register", form);
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
      title="Create your account"
      subtitle="Start shortening links and generating QR codes for free."
      footer={
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {PERKS.map((perk) => (
            <span key={perk} className="badge border border-slate-200 bg-surface py-1 text-slate-600">
              <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
              {perk}
            </span>
          ))}
        </div>
      }
    >
      <ErrorBox>{error}</ErrorBox>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          id="name"
          label="Full name"
          icon={UserIcon}
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Alex Morgan"
          autoComplete="name"
          required
        />
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
        <div>
          <Field
            id="password"
            label="Password"
            icon={LockIcon}
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="At least 6 characters"
            autoComplete="new-password"
            required
          />
          <StrengthMeter password={form.password} />
        </div>
        <button type="submit" disabled={loading} className="btn-primary mt-2 h-11 w-full">
          {loading ? "Creating account…" : "Create account & get started"}
          {!loading && <ArrowRightIcon className="h-4 w-4" />}
        </button>
      </form>
      <p className="mt-6 rounded-lg bg-slate-50 py-3 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Register;
