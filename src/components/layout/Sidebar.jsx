import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  Box,
  Disc3,
  FolderKanban,
  LayoutDashboard,
  ListOrdered,
  Printer,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/impressoras', label: 'Impressoras', icon: Printer },
  { to: '/filamentos', label: 'Filamentos', icon: Disc3 },
  { to: '/projetos', label: 'Projetos', icon: FolderKanban },
  { to: '/producao', label: 'Produção', icon: ListOrdered },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/pedidos', label: 'Pedidos', icon: ShoppingCart },
  { to: '/financeiro', label: 'Financeiro', icon: Wallet },
  { to: '/manutencao', label: 'Manutenção', icon: Wrench },
  { to: '/biblioteca', label: 'Biblioteca', icon: BookOpen },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

export default function Sidebar({ onNavigate }) {
  const { settings } = useData();

  return (
    <aside className="flex h-full w-60 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
          <Box size={19} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
            {settings?.businessName || 'Gestão 3D'}
          </p>
          <p className="text-[11px] text-slate-400">Projetos & Produção 3D</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
          >
            <Icon size={17} className="shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <p className="px-4 pb-3 text-[10px] text-slate-400 dark:text-slate-600">
        Bambu Lab A1 Combo + AMS ready
      </p>
    </aside>
  );
}
