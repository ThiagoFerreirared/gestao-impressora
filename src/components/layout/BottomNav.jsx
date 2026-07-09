import { Link, useLocation } from 'react-router-dom';
import { NAV_GROUPS, isInGroup } from './navGroups';

// Barra fixa embaixo, só no celular (lg:hidden) — substitui a antiga gaveta
// de menu. Cada aba leva para a 1ª página do grupo; a página certa dentro do
// grupo é escolhida pelas sub-abas (SectionTabs), renderizadas no topo do conteúdo.
export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white lg:hidden dark:border-slate-800 dark:bg-slate-900"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {NAV_GROUPS.map((g) => {
        const active = isInGroup(g, pathname);
        const Icon = g.icon;
        return (
          <Link
            key={g.key}
            to={g.items[0].to}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] font-semibold"
          >
            <span
              className={`flex h-8 w-12 items-center justify-center rounded-xl transition-colors ${
                active
                  ? 'bg-blue-600/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              <Icon size={19} />
            </span>
            <span className={active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}>
              {g.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
