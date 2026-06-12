import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Disc3,
  FolderKanban,
  Package,
  TrendingUp,
  Wallet,
  Wrench,
  XCircle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useData } from '../contexts/DataContext';
import StatCard from '../components/ui/StatCard';
import { ColorDot } from '../components/ui/Badge';
import {
  maintenanceAlerts,
  piecesProduced,
  printStats,
  stockAlerts,
} from '../lib/calculations';
import { EXPENSE_CATEGORIES, PROJECT_STATUS } from '../lib/constants';
import { grams, lastMonths, money, monthKey, monthLabel } from '../lib/format';

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#64748b'];

export default function Dashboard() {
  const { settings, spools, projects, printers, transactions } = useData();
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const filamentSpend = transactions
      .filter((t) => t.type === 'despesa' && t.category === 'filamento')
      .reduce((a, t) => a + (Number(t.value) || 0), 0);
    const revenue = transactions
      .filter((t) => t.type === 'receita')
      .reduce((a, t) => a + (Number(t.value) || 0), 0);
    const expenses = transactions
      .filter((t) => t.type === 'despesa')
      .reduce((a, t) => a + (Number(t.value) || 0), 0);
    const inProgress = projects.filter((p) =>
      ['fila', 'fatiando', 'imprimindo', 'pos_processo'].includes(p.status)
    );
    return {
      filamentSpend,
      revenue,
      profit: revenue - expenses,
      pieces: piecesProduced(projects),
      inProgress,
      prints: printStats(projects),
    };
  }, [transactions, projects]);

  const alerts = useMemo(() => stockAlerts(spools, projects), [spools, projects]);
  const maintAlerts = useMemo(() => maintenanceAlerts(printers), [printers]);

  // Gráfico: despesas x receitas por mês
  const monthly = useMemo(() => {
    const months = lastMonths(6);
    const base = Object.fromEntries(months.map((m) => [m, { month: monthLabel(m), despesas: 0, receitas: 0 }]));
    for (const t of transactions) {
      const k = monthKey(t.date);
      if (!base[k]) continue;
      if (t.type === 'despesa') base[k].despesas += Number(t.value) || 0;
      else base[k].receitas += Number(t.value) || 0;
    }
    return months.map((m) => ({
      ...base[m],
      lucro: base[m].receitas - base[m].despesas,
    }));
  }, [transactions]);

  // Gráfico: consumo de filamento (g) por mês, a partir do histórico das bobinas
  const consumption = useMemo(() => {
    const months = lastMonths(6);
    const base = Object.fromEntries(months.map((m) => [m, 0]));
    for (const s of spools) {
      for (const h of s.usageHistory || []) {
        if (h.type === 'ajuste') continue;
        const k = monthKey(h.date);
        if (k in base) base[k] += Number(h.grams) || 0;
      }
    }
    return months.map((m) => ({ month: monthLabel(m), gramas: Math.round(base[m]) }));
  }, [spools]);

  // Gráfico: despesas por categoria
  const byCategory = useMemo(() => {
    const acc = {};
    for (const t of transactions) {
      if (t.type !== 'despesa') continue;
      acc[t.category] = (acc[t.category] || 0) + (Number(t.value) || 0);
    }
    return Object.entries(acc)
      .map(([k, v]) => ({ name: EXPENSE_CATEGORIES[k] || k, value: Math.round(v * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  const tooltipStyle = {
    backgroundColor: 'rgb(30 41 59)',
    border: '1px solid rgb(51 65 85)',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 12,
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="muted text-sm">Visão geral da operação — {settings.businessName}</p>
      </div>

      {/* Métricas principais */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Disc3} label="Gasto em filamentos" value={money(stats.filamentSpend)} tone="blue" onClick={() => navigate('/filamentos')} />
        <StatCard icon={Wallet} label="Faturado" value={money(stats.revenue)} tone="green" onClick={() => navigate('/financeiro')} />
        <StatCard
          icon={TrendingUp}
          label="Lucro bruto"
          value={money(stats.profit)}
          tone={stats.profit >= 0 ? 'green' : 'red'}
          sub="receitas − despesas"
        />
        <StatCard icon={Package} label="Peças produzidas" value={stats.pieces} tone="purple" sub="testes não contam" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={FolderKanban}
          label="Projetos em andamento"
          value={stats.inProgress.length}
          tone="cyan"
          onClick={() => navigate('/producao')}
        />
        <StatCard icon={CheckCircle2} label="Impressões concluídas" value={stats.prints.completed} tone="green" />
        <StatCard icon={XCircle} label="Falhas registradas" value={stats.prints.failed} tone="red" />
      </div>

      {/* Alertas */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card-pad">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <h2 className="section-title">Alertas de estoque</h2>
          </div>
          {alerts.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma bobina acabando. Tudo em ordem ✓</p>
          ) : (
            <ul className="space-y-2">
              {alerts.map(({ spool, status, allocations }) => (
                <li
                  key={spool.id}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    allocations.length > 0
                      ? 'border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10'
                      : 'border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10'
                  }`}
                >
                  <Link to="/filamentos" className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
                    <ColorDot hex={spool.colorHex} />
                    {spool.material} {spool.colorName} ({spool.brand}) —{' '}
                    {status === 'esgotada' ? 'esgotada' : `restam ${grams(spool.currentWeight)}`}
                  </Link>
                  {allocations.length > 0 && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      ⚠ Atenção: esta bobina está alocada em{' '}
                      {allocations.map((p, i) => (
                        <span key={p.id}>
                          {i > 0 && ', '}
                          <Link to={`/projetos/${p.id}`} className="font-semibold underline">
                            {p.name}
                          </Link>
                        </span>
                      ))}
                      . Reponha antes de produzir!
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-pad">
          <div className="mb-3 flex items-center gap-2">
            <Wrench size={16} className="text-blue-500" />
            <h2 className="section-title">Próximas manutenções</h2>
          </div>
          {maintAlerts.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma manutenção próxima do vencimento ✓</p>
          ) : (
            <ul className="space-y-2">
              {maintAlerts.map((a, i) => (
                <li
                  key={i}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
                    a.level === 'overdue'
                      ? 'border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10'
                      : 'border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10'
                  }`}
                >
                  <Link to="/manutencao" className="min-w-0 truncate font-semibold text-slate-800 dark:text-slate-100">
                    {a.printer.name}: {a.type}
                  </Link>
                  <span className={`shrink-0 text-xs font-bold ${a.level === 'overdue' ? 'text-red-500' : 'text-amber-500'}`}>
                    {a.level === 'overdue'
                      ? `vencida há ${Math.abs(Math.round(a.remaining))}h`
                      : `faltam ${Math.round(a.remaining)}h`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Projetos em andamento */}
      {stats.inProgress.length > 0 && (
        <div className="card-pad">
          <h2 className="section-title mb-3">Em andamento agora</h2>
          <div className="flex flex-wrap gap-2">
            {stats.inProgress.slice(0, 10).map((p) => (
              <Link
                key={p.id}
                to={`/projetos/${p.id}`}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:border-blue-500 dark:border-slate-700"
              >
                {p.name}
                <span className={PROJECT_STATUS[p.status]?.badge}>{PROJECT_STATUS[p.status]?.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card-pad xl:col-span-2">
          <h2 className="section-title mb-3">Custos × Receitas × Lucro (6 meses)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#33415540" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="receitas" name="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="lucro" name="Lucro" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card-pad">
          <h2 className="section-title mb-3">Despesas por categoria</h2>
          {byCategory.length === 0 ? (
            <p className="text-sm text-slate-400">Sem despesas registradas ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                  {byCategory.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card-pad">
        <h2 className="section-title mb-3">Consumo de filamento (g/mês)</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={consumption}>
            <CartesianGrid strokeDasharray="3 3" stroke="#33415540" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => grams(v)} />
            <Line type="monotone" dataKey="gramas" name="Consumo" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
