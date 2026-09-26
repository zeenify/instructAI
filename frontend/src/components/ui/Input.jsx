export default function Input({ icon: Icon, label, ...props }) {
  return (
    <div className="flex flex-col gap-2 w-full text-left">
      {label && (
        <label className="text-[13.5px] font-semibold ml-1" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </label>
      )}
      <div className="relative group">
        {Icon && (
          <div
            className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors pointer-events-none group-focus-within:text-[var(--accent)]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <Icon size={18} />
          </div>
        )}
        <input
          {...props}
          className={`w-full rounded-xl ${
            Icon ? "pl-12" : "pl-4"
          } pr-4 focus:outline-none transition-all duration-200`}
          style={{
            padding: '12px 16px',
            paddingLeft: Icon ? '48px' : '16px',
            background: 'var(--student-input-bg, #ffffff)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            fontSize: '15px',
          }}
        />
      </div>
    </div>
  );
}
