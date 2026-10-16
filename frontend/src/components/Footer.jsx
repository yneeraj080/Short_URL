const Footer = () => (
  <footer className="border-t border-slate-200 bg-surface">
    <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:px-6">
      <p>
        <span className="font-semibold text-slate-900">SnipQR</span> · Short links, QR codes and click analytics.
      </p>
      <p className="font-mono text-xs text-slate-400">© {new Date().getFullYear()} SnipQR</p>
    </div>
  </footer>
);

export default Footer;
