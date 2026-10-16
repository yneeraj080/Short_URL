const StatCard = ({ label, value, hint, icon: IconCmp, tone = "brand" }) => {
  const tones = {
    brand: "bg-brand-soft text-brand",
    sky: "bg-sky-50 text-sky-600",
    emerald: "bg-emerald-50 text-emerald-600",
    slate: "bg-slate-100 text-slate-500",
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {IconCmp && (
          <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}>
            <IconCmp className="h-[18px] w-[18px]" />
          </span>
        )}
      </div>
      <p className="tabular mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
};

export default StatCard;
