export default function StatCard({ icon: Icon, label, value, sub, tone = 'blue', onClick }) {
  const tones = {
    blue: 'bg-blue-500/10 text-blue-500',
    green: 'bg-green-500/10 text-green-500',
    yellow: 'bg-amber-500/10 text-amber-500',
    red: 'bg-red-500/10 text-red-500',
    purple: 'bg-purple-500/10 text-purple-500',
    cyan: 'bg-cyan-500/10 text-cyan-500',
  };
  return (
    <div
      className={`card-pad flex items-center gap-3.5 ${onClick ? 'cursor-pointer hover:border-blue-500/50' : ''}`}
      onClick={onClick}
    >
      {Icon && (
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon size={22} />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p className="truncate text-xl font-bold text-slate-900 dark:text-white">{value}</p>
        {sub && <p className="truncate text-xs text-slate-400 dark:text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}
