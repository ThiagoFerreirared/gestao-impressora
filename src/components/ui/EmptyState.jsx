import { PackageOpen } from 'lucide-react';

export default function EmptyState({ icon: Icon = PackageOpen, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
      <Icon size={36} className="text-slate-300 dark:text-slate-600" />
      <p className="font-semibold text-slate-600 dark:text-slate-300">{title}</p>
      {message && <p className="max-w-sm text-sm text-slate-400 dark:text-slate-500">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
