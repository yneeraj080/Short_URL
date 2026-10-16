import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import { LogoutIcon, MenuIcon, XIcon } from "./Icons";

const navClass = ({ isActive }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
    isActive ? "bg-brand-soft text-brand" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  }`;

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const links = [
    { to: "/", label: "Shortener", end: true },
    ...(user
      ? [
          { to: "/dashboard", label: "Dashboard" },
          { to: "/profile", label: "Profile" },
        ]
      : []),
  ];

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate("/login");
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Logo className="h-8" />
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={navClass}>
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          {user ? (
            <>
              <Link to="/profile" className="flex items-center gap-2" title="Profile">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
                  {user.name?.charAt(0).toUpperCase()}
                </span>
                <span className="max-w-[10rem] truncate text-sm font-medium text-slate-700">{user.name}</span>
              </Link>
              <span className="h-6 w-px bg-slate-200" />
              <button onClick={handleLogout} className="btn-ghost !py-1.5">
                <LogoutIcon className="h-4 w-4" />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost !py-2">
                Sign in
              </Link>
              <Link to="/register" className="btn-primary !py-2">
                Get started
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            className="btn-ghost !p-2"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <XIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-surface px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={navClass} onClick={() => setOpen(false)}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-3 border-t border-slate-100 pt-3">
            {user ? (
              <button onClick={handleLogout} className="btn-ghost w-full !justify-start text-red-600">
                <LogoutIcon className="h-4 w-4" />
                Logout ({user.name})
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link to="/login" onClick={() => setOpen(false)} className="btn-secondary">
                  Sign in
                </Link>
                <Link to="/register" onClick={() => setOpen(false)} className="btn-primary">
                  Get started
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
