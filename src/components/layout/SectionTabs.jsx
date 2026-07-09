import { Link, useLocation } from 'react-router-dom';
import { activeGroup } from './navGroups';

// Sub-abas em pílula, estilo "Painel / Clientes / Vendas / Inventário" do app
// de referência. Some quando o grupo ativo tem só 1 página (Painel, Definições).
export default function SectionTabs() {
  const { pathname } = useLocation();
  const group = activeGroup(pathname);
  if (!group || group.items.length < 2) return null;

  return (
    <div className="border-b border-slate-200 bg-white px-4 py-2 lg:hidden dark:border-slate-800 dark:bg-slate-900 sm:px-6">
      <div className="flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        {group.items.map((item) => {
          const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
