import { Outlet } from 'react-router-dom';
import { LogOut, Moon, Sun } from 'lucide-react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import SectionTabs from './SectionTabs';
import GlobalSearch from './GlobalSearch';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useData } from '../../contexts/DataContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { ready } = useData();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar desktop */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-1.5">
            <button className="btn-icon" onClick={toggle} title="Alternar tema">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span className="hidden max-w-[160px] truncate text-xs text-slate-400 sm:block" title={user?.email}>
              {user?.email}
            </span>
            <button className="btn-icon" onClick={logout} title="Sair">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Sub-abas do grupo ativo (só mobile) */}
        <SectionTabs />

        {/* Conteúdo */}
        <main className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 lg:pb-6">
          {!ready ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                <p className="text-sm">Carregando seus dados...</p>
              </div>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      {/* Barra fixa embaixo (só mobile) */}
      <BottomNav />
    </div>
  );
}
