export default function Input({ icon: Icon, label, ...props }) {
  return (
    <div className="flex flex-col gap-2 w-full text-left">
      {label && (
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">
          {label}
        </label>
      )}
      <div className="relative group">
        {Icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-purple-400 transition-colors pointer-events-none">
            <Icon size={18} />
          </div>
        )}
        <input
          {...props}
          className={`w-full bg-white/[0.03] border border-white/10 rounded-xl py-3.5 ${
            Icon ? "pl-12" : "pl-4"
          } pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.06] transition-all duration-300 shadow-inner`}
        />
      </div>
    </div>
  );
}


