import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, FileText } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import StatCard from '../components/ui/StatCard';
import { projectCosts, projectPrices, wasteStats } from '../lib/calculations';
import { exportExcel, exportPDF } from '../lib/export';
import { fixed2, grams, hoursLabel, money, toDate } from '../lib/format';
import { Clock, Droplets, Trash2 as WasteIcon, TrendingUp } from 'lucide-react';

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#64748b', '#ec4899'];

export default function Reports() {
  const { projects, spools, spoolsById, printers, printersById, settings } = useData();
  const toast = useToast();
  const [days, setDays] = useState(''); // '' = tudo

  const ctx = { spoolsById, printersById, settings };
  const from = useMemo(() => {
    if (!days) return null;
    const d = new Date();
    d.setDate(d.getDate() - Number(days));
    return d;
  }, [days]);

  const inPeriod = (dateValue) => {
    if (!from) return true;
    const d = toDate(dateValue);
    return d ? d >= from : false;
  };

  // ── Peças mais lucrativas ──
  const profitable = useMemo(
    () =>
      projects
        .filter((p) => !p.isTest && ['concluido', 'entregue'].includes(p.status) && inPeriod(p.completedAt || p.createdAt))
        .map((p) => {
          const est = projectCosts(p, ctx, { real: false }).total;
          const real = projectCosts(p, ctx, { real: true }).total;
          const price = projectPrices(p, ctx).finalPrice;
          return { id: p.id, name: p.name, est, real, price, profit: price - real };
        })
        .sort((a, b) => b.profit - a.profit),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, spoolsById, printersById, settings, from]
  );

  // ── Materiais mais usados (g) ──
  const materialUsage = useMemo(() => {
    const acc = {};
    for (const s of spools) {
      for (const h of s.usageHistory || []) {
        if (h.type === 'ajuste' || !inPeriod(h.date)) continue;
        acc[s.material] = acc[s.material] || { material: s.material, grams: 0, cost: 0 };
        acc[s.material].grams += Number(h.grams) || 0;
        acc[s.material].cost += Number(h.cost) || 0;
      }
    }
    return Object.values(acc).sort((a, b) => b.grams - a.grams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spools, from]);

  // ── Falhas por tipo e por impressora ──
  const failures = useMemo(() => {
    const byType = {};
    const byPrinter = {};
    let total = 0;
    let cost = 0;
    for (const p of projects) {
      for (const f of p.failures || []) {
        if (!inPeriod(f.date)) continue;
        total += 1;
        cost += Number(f.cost) || 0;
        byType[f.reason] = (byType[f.reason] || 0) + 1;
        const printerName = printersById[f.printerId]?.name || 'Sem impressora';
        byPrinter[printerName] = (byPrinter[printerName] || 0) + 1;
      }
    }
    return {
      total,
      cost,
      byType: Object.entries(byType).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      byPrinter: Object.entries(byPrinter).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, printersById, from]);

  // ── Custo médio por hora de impressão (partes concluídas no período) ──
  const hourly = useMemo(() => {
    let minutes = 0;
    let cost = 0;
    for (const p of projects) {
      const breakdown = projectCosts(p, ctx, { real: true });
      for (const part of p.parts || []) {
        if (part.prodStatus !== 'concluido' || !inPeriod(part.finishedAt)) continue;
        minutes += Number(part.realMinutes) || 0;
        const pp = breakdown.perPart.find((x) => x.partId === part.id);
        if (pp) cost += pp.total;
      }
    }
    return { minutes, cost, avg: minutes > 0 ? cost / (minutes / 60) : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, spoolsById, printersById, settings, from]);

  // ── Desperdício ──
  const waste = useMemo(
    () => wasteStats(projects, spoolsById, { from }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, spoolsById, from]
  );

  // ── Estimado vs real ──
  const estVsReal = useMemo(
    () =>
      projects
        .filter((p) => ['concluido', 'entregue'].includes(p.status) && inPeriod(p.completedAt || p.createdAt))
        .map((p) => {
          const snapshot = p.budget?.estimateSnapshot;
          const est = snapshot ? snapshot.total : projectCosts(p, ctx, { real: false }).total;
          const real = projectCosts(p, ctx, { real: true }).total;
          const estMin = (p.parts || []).reduce((a, x) => a + (Number(x.estMinutes) || 0), 0);
          const realMin = (p.parts || []).reduce((a, x) => a + (Number(x.realMinutes) || 0), 0);
          return { id: p.id, name: p.name, est, real, diff: real - est, estMin, realMin, frozen: !!snapshot };
        })
        .sort((a, b) => b.diff - a.diff),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, spoolsById, printersById, settings, from]
  );

  const periodLabel = days ? `Últimos ${days} dias` : 'Todo o período';

  const doExportPDF = () => {
    exportPDF({
      filename: 'relatorios-3d',
      title: `Relatórios — ${settings.businessName}`,
      subtitle: periodLabel,
      sections: [
        {
          title: 'Peças mais lucrativas',
          columns: ['Projeto', 'Custo real', 'Preço', 'Lucro'],
          rows: profitable.map((p) => [p.name, money(p.real), money(p.price), money(p.profit)]),
        },
        {
          title: 'Materiais mais usados',
          columns: ['Material', 'Consumo (g)', 'Custo'],
          rows: materialUsage.map((m) => [m.material, Math.round(m.grams), money(m.cost)]),
        },
        {
          title: `Falhas (${failures.total} • ${money(failures.cost)})`,
          columns: ['Motivo', 'Ocorrências'],
          rows: failures.byType.map((f) => [f.name, f.value]),
        },
        {
          title: 'Estimado vs Real por projeto',
          columns: ['Projeto', 'Estimado', 'Real', 'Diferença'],
          rows: estVsReal.map((p) => [p.name, money(p.est), money(p.real), money(p.diff)]),
        },
      ],
    });
  };

  const doExportExcel = () => {
    exportExcel({
      filename: 'relatorios-3d',
      sheets: [
        {
          name: 'Lucratividade',
          columns: ['Projeto', 'Custo estimado', 'Custo real', 'Preço', 'Lucro'],
          rows: profitable.map((p) => [p.name, p.est, p.real, p.price, p.profit].map((v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v))),
        },
        {
          name: 'Materiais',
          columns: ['Material', 'Consumo (g)', 'Custo (R$)'],
          rows: materialUsage.map((m) => [m.material, Math.round(m.grams), Math.round(m.cost * 100) / 100]),
        },
        {
          name: 'Falhas por tipo',
          columns: ['Motivo', 'Ocorrências'],
          rows: failures.byType.map((f) => [f.name, f.value]),
        },
        {
          name: 'Falhas por impressora',
          columns: ['Impressora', 'Ocorrências'],
          rows: failures.byPrinter.map((f) => [f.name, f.value]),
        },
        {
          name: 'Estimado vs Real',
          columns: ['Projeto', 'Custo estimado (R$)', 'Custo real (R$)', 'Diferença (R$)', 'Tempo est (min)', 'Tempo real (min)'],
          rows: estVsReal.map((p) => [p.name, Math.round(p.est * 100) / 100, Math.round(p.real * 100) / 100, Math.round(p.diff * 100) / 100, p.estMin, p.realMin]),
        },
      ],
    });
    toast('Planilha exportada.');
  };

  const tooltipStyle = {
    backgroundColor: 'rgb(30 41 59)',
    border: '1px solid rgb(51 65 85)',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 12,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Relatórios</h1>
          <p className="muted text-sm">Lucratividade, consumo, falhas e comparativos — {periodLabel.toLowerCase()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="input w-auto" value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="">Todo o período</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="365">Último ano</option>
          </select>
          <button className="btn-secondary" onClick={doExportPDF}><FileText size={15} /> PDF</button>
          <button className="btn-secondary" onClick={doExportExcel}><FileSpreadsheet size={15} /> Excel</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Clock} label="Custo médio / hora de impressão" value={money(hourly.avg)}
          sub={`${hoursLabel(hourly.minutes)} impressos no período`} tone="blue" />
        <StatCard icon={Droplets} label="Filamento consumido" value={grams(materialUsage.reduce((a, m) => a + m.grams, 0))}
          sub={money(materialUsage.reduce((a, m) => a + m.cost, 0))} tone="cyan" />
        <StatCard icon={WasteIcon} label="Desperdício (purga + falhas)" value={grams(waste.totalGrams)}
          sub={money(waste.totalCost)} tone="yellow" />
        <StatCard icon={TrendingUp} label="Falhas" value={failures.total} sub={`prejuízo ${money(failures.cost)}`} tone="red" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Peças mais lucrativas */}
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="section-title">Peças mais lucrativas</h2>
          </div>
          <div className="max-h-80 overflow-auto">
            <table className="table-base">
              <thead><tr><th>Projeto</th><th className="text-right">Custo real</th><th className="text-right">Preço</th><th className="text-right">Lucro</th></tr></thead>
              <tbody>
                {profitable.map((p) => (
                  <tr key={p.id}>
                    <td><Link to={`/projetos/${p.id}`} className="font-semibold text-blue-500 hover:underline">{p.name}</Link></td>
                    <td className="text-right">{money(p.real)}</td>
                    <td className="text-right">{money(p.price)}</td>
                    <td className={`text-right font-bold ${p.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>{money(p.profit)}</td>
                  </tr>
                ))}
                {profitable.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-slate-400">Sem projetos concluídos no período.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Materiais mais usados */}
        <div className="card-pad">
          <h2 className="section-title mb-3">Materiais mais usados (g)</h2>
          {materialUsage.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Sem consumo registrado no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={materialUsage.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#33415540" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis type="category" dataKey="material" width={110} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => grams(v)} />
                <Bar dataKey="grams" name="Consumo" fill="#06b6d4" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Falhas por tipo */}
        <div className="card-pad">
          <h2 className="section-title mb-3">Falhas por tipo</h2>
          {failures.byType.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Nenhuma falha no período 🎉</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={failures.byType} dataKey="value" nameKey="name" outerRadius={85}
                  label={(e) => `${e.name} (${e.value})`} labelLine={false} fontSize={10}>
                  {failures.byType.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Falhas por impressora */}
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="section-title">Falhas por impressora</h2>
          </div>
          <div className="max-h-80 overflow-auto">
            <table className="table-base">
              <thead><tr><th>Impressora</th><th className="text-right">Falhas</th></tr></thead>
              <tbody>
                {failures.byPrinter.map((f) => (
                  <tr key={f.name}>
                    <td className="font-semibold">{f.name}</td>
                    <td className="text-right"><span className="badge-red">{f.value}×</span></td>
                  </tr>
                ))}
                {failures.byPrinter.length === 0 && <tr><td colSpan={2} className="py-8 text-center text-slate-400">Nenhuma falha registrada.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Estimado vs real */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="section-title">Estimado × Real por projeto</h2>
        </div>
        <div className="max-h-96 overflow-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Projeto</th><th className="text-right">Custo est.</th><th className="text-right">Custo real</th>
                <th className="text-right">Diferença</th><th className="text-right">Tempo est.</th><th className="text-right">Tempo real</th>
              </tr>
            </thead>
            <tbody>
              {estVsReal.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/projetos/${p.id}`} className="font-semibold text-blue-500 hover:underline">{p.name}</Link>
                    {p.frozen && <span className="badge-gray ml-2" title="Comparando com estimativa congelada">📌</span>}
                  </td>
                  <td className="text-right">{money(p.est)}</td>
                  <td className="text-right">{money(p.real)}</td>
                  <td className={`text-right font-bold ${p.diff > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {p.diff > 0 ? '+' : ''}{money(p.diff)}
                  </td>
                  <td className="text-right">{hoursLabel(p.estMin)}</td>
                  <td className="text-right">{hoursLabel(p.realMin)}</td>
                </tr>
              ))}
              {estVsReal.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-400">Sem projetos concluídos no período.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Desperdício no período: purga {grams(waste.purgeGrams)} ({money(waste.purgeCost)}) + falhas {grams(waste.failGrams)} ({money(waste.failCost)}).
        Custo médio/hora considera filamento + energia + hora-máquina das partes concluídas ({fixed2(hourly.minutes / 60)} h).
      </p>
    </div>
  );
}
