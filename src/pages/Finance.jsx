import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownCircle, ArrowUpCircle, FileSpreadsheet, FileText, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import DataTable from '../components/ui/DataTable';
import StatCard from '../components/ui/StatCard';
import { FormGrid, Input, Select, Textarea } from '../components/ui/Field';
import { EXPENSE_CATEGORIES, REVENUE_CATEGORIES } from '../lib/constants';
import { projectCosts, projectPrices } from '../lib/calculations';
import { exportExcel, exportPDF } from '../lib/export';
import { dateBR, money, monthKey, monthLabel, todayInput, toNum } from '../lib/format';

const EMPTY = { type: 'despesa', category: 'filamento', description: '', value: '', date: todayInput() };

export default function Finance() {
  const { transactions, projects, spoolsById, printersById, settings, api } = useData();
  const toast = useToast();
  const [period, setPeriod] = useState(''); // '' = tudo, 'yyyy-mm'
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [confirm, setConfirm] = useState(null);

  const ctx = { spoolsById, printersById, settings };

  const months = useMemo(() => {
    const set = new Set(transactions.map((t) => monthKey(t.date)).filter(Boolean));
    return [...set].sort().reverse();
  }, [transactions]);

  const filtered = useMemo(
    () => (period ? transactions.filter((t) => monthKey(t.date) === period) : transactions),
    [transactions, period]
  );

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filtered) {
      if (t.type === 'receita') income += Number(t.value) || 0;
      else expense += Number(t.value) || 0;
    }
    return { income, expense, profit: income - expense };
  }, [filtered]);

  // Lucro por projeto: preço final − custo real (projetos vendáveis concluídos/entregues)
  const projectProfit = useMemo(
    () =>
      projects
        .filter((p) => !p.isTest && ['concluido', 'entregue'].includes(p.status))
        .map((p) => {
          const est = projectCosts(p, ctx, { real: false }).total;
          const real = projectCosts(p, ctx, { real: true }).total;
          const price = projectPrices(p, ctx).finalPrice;
          return { ...p, _est: est, _real: real, _price: price, _profit: price - real, _margin: price > 0 ? ((price - real) / price) * 100 : 0 };
        })
        .sort((a, b) => b._profit - a._profit),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, spoolsById, printersById, settings]
  );

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const save = async () => {
    if (!form.description.trim()) return toast('Informe a descrição.', 'warning');
    if (toNum(form.value) <= 0) return toast('Informe o valor.', 'warning');
    const data = {
      type: form.type,
      category: form.category,
      description: form.description.trim(),
      value: toNum(form.value),
      date: form.date,
      auto: false,
    };
    if (modal.id) {
      await api.update('transactions', modal.id, data, data.description);
      toast('Lançamento atualizado.');
    } else {
      await api.add('transactions', data, data.description);
      toast('Lançamento registrado.');
    }
    setModal(null);
  };

  const doExportPDF = () => {
    exportPDF({
      filename: `financeiro${period ? `-${period}` : ''}`,
      title: `Relatório Financeiro — ${settings.businessName}`,
      subtitle: period ? `Período: ${monthLabel(period)}` : 'Todo o período',
      sections: [
        {
          title: `Resumo: receitas ${money(totals.income)} • despesas ${money(totals.expense)} • lucro ${money(totals.profit)}`,
          columns: ['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor'],
          rows: filtered.map((t) => [
            dateBR(t.date),
            t.type,
            (t.type === 'despesa' ? EXPENSE_CATEGORIES : REVENUE_CATEGORIES)[t.category] || t.category,
            t.description,
            money(t.value),
          ]),
        },
        {
          title: 'Lucro por projeto (concluídos)',
          columns: ['Projeto', 'Custo estimado', 'Custo real', 'Preço', 'Lucro'],
          rows: projectProfit.map((p) => [p.name, money(p._est), money(p._real), money(p._price), money(p._profit)]),
        },
      ],
    });
  };

  const doExportExcel = () => {
    exportExcel({
      filename: `financeiro${period ? `-${period}` : ''}`,
      sheets: [
        {
          name: 'Lançamentos',
          columns: ['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor (R$)'],
          rows: filtered.map((t) => [
            dateBR(t.date),
            t.type,
            (t.type === 'despesa' ? EXPENSE_CATEGORIES : REVENUE_CATEGORIES)[t.category] || t.category,
            t.description,
            Number(t.value) || 0,
          ]),
        },
        {
          name: 'Lucro por projeto',
          columns: ['Projeto', 'Custo estimado (R$)', 'Custo real (R$)', 'Preço (R$)', 'Lucro (R$)', 'Margem (%)'],
          rows: projectProfit.map((p) => [
            p.name,
            Math.round(p._est * 100) / 100,
            Math.round(p._real * 100) / 100,
            Math.round(p._price * 100) / 100,
            Math.round(p._profit * 100) / 100,
            Math.round(p._margin * 10) / 10,
          ]),
        },
      ],
    });
    toast('Planilha exportada.');
  };

  const categoryOptions =
    form.type === 'despesa'
      ? Object.entries(EXPENSE_CATEGORIES).map(([value, label]) => ({ value, label }))
      : Object.entries(REVENUE_CATEGORIES).map(([value, label]) => ({ value, label }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Financeiro</h1>
          <p className="muted text-sm">Despesas, receitas e lucro — automáticos e manuais</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="input w-auto" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="">Todo o período</option>
            {months.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
          <button className="btn-secondary" onClick={doExportPDF}><FileText size={15} /> PDF</button>
          <button className="btn-secondary" onClick={doExportExcel}><FileSpreadsheet size={15} /> Excel</button>
          <button className="btn-primary" onClick={() => { setForm({ ...EMPTY, date: todayInput() }); setModal({}); }}>
            <Plus size={16} /> Lançamento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={ArrowUpCircle} label="Receitas" value={money(totals.income)} tone="green" />
        <StatCard icon={ArrowDownCircle} label="Despesas" value={money(totals.expense)} tone="red" />
        <StatCard icon={Wallet} label="Lucro" value={money(totals.profit)} tone={totals.profit >= 0 ? 'blue' : 'red'} />
      </div>

      <DataTable
        data={filtered}
        searchKeys={['description']}
        searchPlaceholder="Buscar lançamento..."
        filters={[
          {
            key: 'type',
            label: 'Tipo',
            options: [
              { value: 'despesa', label: 'Despesas' },
              { value: 'receita', label: 'Receitas' },
            ],
          },
          {
            key: 'category',
            label: 'Categoria',
            options: [
              ...Object.entries(EXPENSE_CATEGORIES).map(([value, label]) => ({ value, label })),
              ...Object.entries(REVENUE_CATEGORIES).filter(([v]) => v !== 'outros').map(([value, label]) => ({ value, label })),
            ],
          },
        ]}
        columns={[
          { key: 'date', label: 'Data', sortValue: (r) => r.date || '', render: (r) => dateBR(r.date) },
          {
            key: 'type',
            label: 'Tipo',
            sortValue: (r) => r.type,
            render: (r) =>
              r.type === 'receita' ? <span className="badge-green">receita</span> : <span className="badge-red">despesa</span>,
          },
          {
            key: 'category',
            label: 'Categoria',
            sortValue: (r) => r.category,
            render: (r) => (r.type === 'despesa' ? EXPENSE_CATEGORIES : REVENUE_CATEGORIES)[r.category] || r.category,
          },
          {
            key: 'description',
            label: 'Descrição',
            render: (r) => (
              <span>
                {r.description}
                {r.auto && <span className="badge-gray ml-2">auto</span>}
              </span>
            ),
          },
          {
            key: 'value',
            label: 'Valor',
            sortValue: (r) => Number(r.value) || 0,
            render: (r) => (
              <span className={`font-bold ${r.type === 'receita' ? 'text-green-500' : 'text-red-500'}`}>
                {r.type === 'receita' ? '+' : '−'}{money(r.value)}
              </span>
            ),
          },
        ]}
        initialSort={{ key: 'date', dir: 'desc' }}
        emptyTitle="Nenhum lançamento"
        emptyMessage="Compras de bobina, manutenções e pedidos pagos geram lançamentos automáticos."
        rowActions={(r) => (
          <>
            <button className="btn-icon" title="Editar" onClick={() => {
              setForm({ type: r.type, category: r.category, description: r.description, value: String(r.value), date: r.date || todayInput() });
              setModal({ id: r.id });
            }}>
              <Pencil size={15} />
            </button>
            <button className="btn-icon hover:!text-red-500" title="Excluir" onClick={() => setConfirm(r)}>
              <Trash2 size={15} />
            </button>
          </>
        )}
      />

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="section-title">Lucro por projeto — estimado × real</h2>
        </div>
        <div className="max-h-[50vh] overflow-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Projeto</th><th className="text-right">Custo est.</th><th className="text-right">Custo real</th>
                <th className="text-right">Preço</th><th className="text-right">Lucro</th><th className="text-right">Margem</th>
              </tr>
            </thead>
            <tbody>
              {projectProfit.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/projetos/${p.id}`} className="font-semibold text-blue-500 hover:underline">{p.name}</Link>
                  </td>
                  <td className="text-right">{money(p._est)}</td>
                  <td className={`text-right ${p._real > p._est ? 'text-red-500' : ''}`}>{money(p._real)}</td>
                  <td className="text-right">{money(p._price)}</td>
                  <td className={`text-right font-bold ${p._profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>{money(p._profit)}</td>
                  <td className="text-right">{p._margin.toFixed(1)}%</td>
                </tr>
              ))}
              {projectProfit.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400">Nenhum projeto concluído ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.id ? 'Editar lançamento' : 'Novo lançamento'}
        size="sm"
        footer={<><button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
          <button className="btn-primary" onClick={save}>Salvar</button></>}
      >
        <div className="space-y-3.5">
          <FormGrid cols={2}>
            <Select label="Tipo" name="type" value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value, category: e.target.value === 'despesa' ? 'filamento' : 'venda' }))}
              options={[{ value: 'despesa', label: 'Despesa' }, { value: 'receita', label: 'Receita' }]} />
            <Select label="Categoria" name="category" value={form.category} onChange={set} options={categoryOptions} />
          </FormGrid>
          <Input label="Descrição *" name="description" value={form.description} onChange={set} />
          <FormGrid cols={2}>
            <Input label="Valor (R$) *" name="value" inputMode="decimal" value={form.value} onChange={set} />
            <Input label="Data" type="date" name="date" value={form.date} onChange={set} />
          </FormGrid>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Excluir lançamento"
        message={`Excluir "${confirm?.description}" (${money(confirm?.value)})?`}
        onConfirm={async () => {
          await api.remove('transactions', confirm.id, confirm.description);
          toast('Lançamento excluído.');
        }}
      />
    </div>
  );
}
