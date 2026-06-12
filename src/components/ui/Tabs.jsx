export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
            active === t.key
              ? 'bg-blue-600 text-white'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={`ml-1.5 text-xs ${active === t.key ? 'text-blue-200' : 'text-slate-400'}`}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
