import { useMemo, useState } from 'react';
import {
  Boxes,
  Factory,
  ListChecks,
  Package,
  Pencil,
  Plus,
  Tag,
  Trash2,
} from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import DataTable from '../components/ui/DataTable';
import StatCard from '../components/ui/StatCard';
import StatusBadge, { ColorDot } from '../components/ui/Badge';
import SearchSelect from '../components/ui/SearchSelect';
import { spoolOptions } from '../components/domain/SlotEditor';
import { FormGrid, Input, Select, Textarea } from '../components/ui/Field';
import { AMS_SLOTS, PRODUCT_CATEGORIES, PRODUCT_STOCK_STATUS } from '../lib/constants';
import { productFilamentCost, productStockStatus, productUnitCost, suggestedPrice } from '../lib/calculations';
import { adjustProductStock, produceStock } from '../lib/ops';
import { dateBR, durationInput, grams, hoursLabel, money, parseDuration, toNum, uid as genId } from '../lib/format';

const EMPTY = {
  name: '',
  category: 'Chaveiro',
  website: '',
  printerId: '',
  slots: [{ id: genId(), spoolId: '', grams: '' }],
  printDuration: '',
  laborCost: '',
  packagingCost: '',
  deliveryCost: '',
  customCosts: [],
  tags: [],
  lowStockThreshold: '3',
  notes: '',
};

export default function Products() {
  const { products, spools, spoolsById, printers, printersById, settings, api } = useData();
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [confirm, setConfirm] = useState(null);
  const [produce, setProduce] = useState(null);
  const [produceQty, setProduceQty] = useState('1');
  const [adjust, setAdjust] = useState(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [tagInput, setTagInput] = useState('');

  const ctx = { spoolsById, printersById, settings };

  const allTags = useMemo(
    () => [...new Set(products.flatMap((p) => p.tags || []))].sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const rows = useMemo(
    () =>
      products.map((p) => {
        const cost = productUnitCost(p, ctx);
        const suggested = suggestedPrice(cost.total, settings.margins?.sale ?? 50);
        return { ...p, _cost: cost, _suggested: suggested, _stockStatus: productStockStatus(p) };
      }),
    [products, spoolsById, printersById, settings]
  );

  const stats = useMemo(() => {
    const total = rows.length;
    const emEstoque = rows.filter((r) => r._stockStatus === 'em_estoque').length;
    const baixo = rows.filter((r) => r._stockStatus === 'estoque_baixo').length;
    const sem = rows.filter((r) => r._stockStatus === 'sem_estoque').length;
    return { total, emEstoque, baixo, sem };
  }, [rows]);

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const openNew = () => {
    setForm({ ...EMPTY, id: undefined, slots: [{ id: genId(), spoolId: '', grams: '' }], lowStockThreshold: String(settings.lowStockProductDefault || 3) });
    setModal({});
  };

  const openEdit = (p) => {
    setForm({
      name: p.name || '',
      category: p.category || 'Chaveiro',
      website: p.website || '',
      printerId: p.printerId || '',
      slots: (p.slots || []).length ? p.slots.map((s) => ({ ...s, grams: String(s.grams ?? '') })) : [{ id: genId(), spoolId: '', grams: '' }],
      printDuration: durationInput(p.printMinutes),
      laborCost: String(p.laborCost ?? ''),
      packagingCost: String(p.packagingCost ?? ''),
      deliveryCost: String(p.deliveryCost ?? ''),
      customCosts: (p.customCosts || []).map((c) => ({ ...c, value: String(c.value ?? '') })),
      tags: p.tags || [],
      lowStockThreshold: String(p.lowStockThreshold ?? 3),
      notes: p.notes || '',
    });
    setModal({ id: p.id, product: p });
  };

  const updateSlot = (i, patch) =>
    setForm((f) => ({ ...f, slots: f.slots.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const addSlot = () => {
    if (form.slots.length >= AMS_SLOTS.length) return;
    setForm((f) => ({ ...f, slots: [...f.slots, { id: genId(), spoolId: '', grams: '' }] }));
  };
  const removeSlot = (i) => setForm((f) => ({ ...f, slots: f.slots.filter((_, j) => j !== i) }));

  const addCustomCost = () =>
    setForm((f) => ({ ...f, customCosts: [...f.customCosts, { id: genId(), label: '', value: '' }] }));
  const updateCustomCost = (i, patch) =>
    setForm((f) => ({ ...f, customCosts: f.customCosts.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const removeCustomCost = (i) => setForm((f) => ({ ...f, customCosts: f.customCosts.filter((_, j) => j !== i) }));

  const addTag = (t) => {
    const v = (t || tagInput).trim();
    if (!v || form.tags.includes(v)) return;
    setForm((f) => ({ ...f, tags: [...f.tags, v] }));
    setTagInput('');
  };
  const removeTag = (t) => setForm((f) => ({ ...f, tags: f.tags.filter((x) => x !== t) }));

  // Preview de custo em tempo real, refletindo o formulário ainda não salvo
  const preview = useMemo(() => {
    const draft = {
      slots: form.slots.map((s) => ({ spoolId: s.spoolId, grams: toNum(s.grams) })),
      printMinutes: parseDuration(form.printDuration),
      printerId: form.printerId,
      laborCost: toNum(form.laborCost),
      packagingCost: toNum(form.packagingCost),
      deliveryCost: toNum(form.deliveryCost),
      customCosts: form.customCosts.map((c) => ({ value: toNum(c.value) })),
    };
    return productUnitCost(draft, ctx);
  }, [form, spoolsById, printersById, settings]);

  const save = async () => {
    if (!form.name.trim()) return toast('Informe o nome do produto.', 'warning');
    const validSlots = form.slots.filter((s) => s.spoolId && toNum(s.grams) > 0);
    if (validSlots.length === 0) return toast('Selecione ao menos um filamento e o peso em gramas.', 'warning');
    const data = {
      name: form.name.trim(),
      category: form.category,
      website: form.website.trim(),
      printerId: form.printerId,
      slots: validSlots.map((s) => ({ id: s.id || genId(), spoolId: s.spoolId, grams: toNum(s.grams) })),
      printMinutes: parseDuration(form.printDuration),
      laborCost: toNum(form.laborCost),
      packagingCost: toNum(form.packagingCost),
      deliveryCost: toNum(form.deliveryCost),
      customCosts: form.customCosts.filter((c) => c.label.trim()).map((c) => ({ id: c.id || genId(), label: c.label.trim(), value: toNum(c.value) })),
      tags: form.tags,
      lowStockThreshold: toNum(form.lowStockThreshold) || 0,
      notes: form.notes,
    };
    try {
      if (modal.id) {
        await api.update('products', modal.id, data, data.name);
        toast('Produto atualizado.');
      } else {
        await api.add('products', { ...data, stockQty: 0, productionHistory: [], stockAdjustments: [] }, data.name);
        toast('Produto cadastrado. Use "Produzir lote" para dar entrada no estoque.');
      }
      setModal(null);
    } catch (err) {
      toast(`Erro ao salvar: ${err.message}`, 'error');
    }
  };

  const doProduce = async () => {
    const qty = toNum(produceQty);
    if (qty <= 0) return toast('Informe uma quantidade válida.', 'warning');
    try {
      await produceStock(api, produce, { qty, spoolsById });
      toast(`+${qty} un. adicionadas ao estoque de "${produce.name}".`);
      setProduce(null);
      setProduceQty('1');
    } catch (err) {
      toast(`Erro: ${err.message}`, 'error');
    }
  };

  const doAdjust = async () => {
    try {
      await adjustProductStock(api, adjust, toNum(adjustQty), 'Ajuste manual');
      toast('Estoque ajustado.');
      setAdjust(null);
    } catch (err) {
      toast(`Erro: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Produtos & Estoque</h1>
          <p className="muted text-sm">Receitas reutilizáveis produzidas em lote e vendidas aos poucos — ligado ao estoque de filamentos</p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus size={16} /> Novo produto
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Boxes} label="Produtos" value={stats.total} tone="blue" />
        <StatCard icon={Package} label="Em estoque" value={stats.emEstoque} tone="green" />
        <StatCard icon={ListChecks} label="Estoque baixo" value={stats.baixo} tone="yellow" />
        <StatCard icon={Package} label="Sem estoque" value={stats.sem} tone="red" />
      </div>

      <DataTable
        data={rows}
        searchKeys={['name', 'category', (r) => (r.tags || []).join(' ')]}
        searchPlaceholder="Buscar por nome, categoria, tag..."
        filters={[
          { key: 'category', label: 'Categoria', options: PRODUCT_CATEGORIES.map((c) => ({ value: c, label: c })) },
          {
            key: 'status',
            label: 'Estoque',
            options: Object.entries(PRODUCT_STOCK_STATUS).map(([value, v]) => ({ value, label: v.label })),
            fn: (r, v) => r._stockStatus === v,
          },
        ]}
        columns={[
          {
            key: 'name',
            label: 'Produto',
            sortValue: (r) => r.name,
            render: (r) => (
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100">{r.name}</p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
                  <span>{r.category}</span>
                  {(r.tags || []).slice(0, 3).map((t) => (
                    <span key={t} className="badge-gray !px-1.5 !py-0">{t}</span>
                  ))}
                </p>
              </div>
            ),
          },
          {
            key: 'recipe',
            label: 'Receita',
            render: (r) => (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {(r.slots || []).map((s, i) => {
                  const spool = spoolsById[s.spoolId];
                  return (
                    <div key={i} className="flex items-center gap-1.5">
                      <ColorDot hex={spool?.colorHex} size={10} />
                      <span>{spool ? `${spool.material} ${spool.colorName}` : '—'} · {grams(s.grams)}</span>
                    </div>
                  );
                })}
                {r.printMinutes > 0 && <p>{hoursLabel(r.printMinutes)} de impressão</p>}
              </div>
            ),
          },
          {
            key: 'cost',
            label: 'Custo/un',
            sortValue: (r) => r._cost.total,
            render: (r) => <span className="font-semibold">{money(r._cost.total)}</span>,
          },
          {
            key: 'suggested',
            label: 'Preço sugerido',
            sortValue: (r) => r._suggested,
            render: (r) => <span className="font-semibold text-blue-500">{money(r._suggested)}</span>,
          },
          {
            key: 'stock',
            label: 'Estoque',
            sortValue: (r) => Number(r.stockQty) || 0,
            render: (r) => (
              <div className="space-y-1">
                <p className="text-base font-bold">{Number(r.stockQty) || 0} <span className="text-xs font-normal muted">un.</span></p>
                <StatusBadge map={PRODUCT_STOCK_STATUS} value={r._stockStatus} />
              </div>
            ),
          },
        ]}
        initialSort={{ key: 'name', dir: 'asc' }}
        emptyTitle="Nenhum produto cadastrado"
        emptyMessage='Cadastre um produto (ex.: "Chaveiro polvo azul") com a receita de filamento e produza o primeiro lote.'
        onRowClick={(r) => { setAdjust(r); setAdjustQty(String(r.stockQty ?? 0)); }}
        rowActions={(r) => (
          <>
            <button className="btn-icon !text-green-500" title="Produzir lote (dá entrada no estoque e desconta filamento)" onClick={() => setProduce(r)}>
              <Factory size={16} />
            </button>
            <button className="btn-icon" title="Ajustar estoque manualmente" onClick={() => { setAdjust(r); setAdjustQty(String(r.stockQty ?? 0)); }}>
              <ListChecks size={15} />
            </button>
            <button className="btn-icon" title="Editar" onClick={() => openEdit(r)}>
              <Pencil size={15} />
            </button>
            <button className="btn-icon hover:!text-red-500" title="Excluir" onClick={() => setConfirm(r)}>
              <Trash2 size={15} />
            </button>
          </>
        )}
      />

      {/* ───── Modal produto ───── */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.id ? 'Editar produto' : 'Novo produto'}
        size="lg"
        footer={
          <>
            <span className="mr-auto text-xs text-slate-400">
              Custo/un: <b className="text-blue-500">{money(preview.total)}</b> · Sugerido (
              {settings.margins?.sale ?? 50}%): <b className="text-green-500">{money(suggestedPrice(preview.total, settings.margins?.sale ?? 50))}</b>
            </span>
            <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-primary" onClick={save}>Salvar</button>
          </>
        }
      >
        <div className="space-y-4">
          <FormGrid cols={2}>
            <Input label="Nome *" name="name" value={form.name} onChange={set} placeholder="Ex: Chaveiro polvo azul" />
            <Select label="Categoria" name="category" value={form.category} onChange={set} options={PRODUCT_CATEGORIES} />
            <Input label="Website / modelo (opcional)" name="website" value={form.website} onChange={set} placeholder="https://makerworld.com/..." />
            <Select label="Impressora (p/ depreciação)" name="printerId" value={form.printerId} onChange={set}
              placeholder="Nenhuma" options={printers.map((p) => ({ value: p.id, label: p.name }))} />
          </FormGrid>

          <div>
            <p className="label">Receita de filamento *</p>
            <div className="space-y-2">
              {form.slots.map((slot, i) => {
                const spool = spoolsById[slot.spoolId];
                const cost = toNum(slot.grams) * (spool ? productFilamentCost({ slots: [{ spoolId: slot.spoolId, grams: slot.grams }] }, spoolsById) / toNum(slot.grams || 1) : 0);
                return (
                  <div key={slot.id || i} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                    <div className="min-w-[200px] flex-1">
                      <SearchSelect value={slot.spoolId} onChange={(v) => updateSlot(i, { spoolId: v })}
                        options={spoolOptions(spools, { includeEmpty: true })} placeholder="Selecionar filamento..." />
                    </div>
                    <input className="input w-28" inputMode="decimal" placeholder="Gramas" value={slot.grams}
                      onChange={(e) => updateSlot(i, { grams: e.target.value })} />
                    <span className="w-20 text-right text-sm font-semibold">{spool ? money(cost) : '—'}</span>
                    {form.slots.length > 1 && (
                      <button className="btn-icon" onClick={() => removeSlot(i)}><Trash2 size={14} /></button>
                    )}
                  </div>
                );
              })}
            </div>
            {form.slots.length < AMS_SLOTS.length && (
              <button className="btn-secondary btn-sm mt-2" onClick={addSlot}>
                <Plus size={13} /> Adicionar cor (multicolor / AMS)
              </button>
            )}
          </div>

          <FormGrid cols={2}>
            <Input label="Tempo de impressão (por unidade)" name="printDuration" value={form.printDuration}
              onChange={set} placeholder="ex: 2:02 (2h02) ou 122 (min)"
              hint="Usado para calcular energia e depreciação da impressora" />
            <Input label="Estoque mínimo (alerta)" name="lowStockThreshold" inputMode="numeric" value={form.lowStockThreshold} onChange={set} />
          </FormGrid>

          <FormGrid cols={3}>
            <Input label="Mão de obra (R$/un)" name="laborCost" inputMode="decimal" value={form.laborCost} onChange={set} />
            <Input label="Embalagem (R$/un)" name="packagingCost" inputMode="decimal" value={form.packagingCost} onChange={set} />
            <Input label="Entrega (R$/un)" name="deliveryCost" inputMode="decimal" value={form.deliveryCost} onChange={set} />
          </FormGrid>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="label !mb-0">Custos personalizados</p>
              <button className="btn-secondary btn-sm" onClick={addCustomCost}><Plus size={13} /> Adicionar</button>
            </div>
            {form.customCosts.length === 0 && <p className="text-xs text-slate-400">Nenhum custo extra.</p>}
            <div className="space-y-2">
              {form.customCosts.map((c, i) => (
                <div key={c.id || i} className="flex items-center gap-2">
                  <input className="input flex-1" placeholder="Descrição" value={c.label} onChange={(e) => updateCustomCost(i, { label: e.target.value })} />
                  <input className="input w-28" inputMode="decimal" placeholder="R$" value={c.value} onChange={(e) => updateCustomCost(i, { value: e.target.value })} />
                  <button className="btn-icon" onClick={() => removeCustomCost(i)}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="label">Etiquetas</p>
            <div className="flex flex-wrap gap-2">
              {form.tags.map((t) => (
                <span key={t} className="badge-blue !px-2.5 !py-1 !text-xs">
                  {t} <button className="ml-1 hover:text-red-500" onClick={() => removeTag(t)}>×</button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input className="input flex-1" placeholder="Adicionar uma etiqueta" value={tagInput}
                onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTag()} />
              <button className="btn-secondary" onClick={() => addTag()}><Tag size={14} /></button>
            </div>
            {allTags.filter((t) => !form.tags.includes(t)).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {allTags.filter((t) => !form.tags.includes(t)).slice(0, 8).map((t) => (
                  <button key={t} className="badge-gray !px-2 !py-0.5 !text-[11px]" onClick={() => addTag(t)}>+ {t}</button>
                ))}
              </div>
            )}
          </div>

          <Textarea label="Observações" name="notes" value={form.notes} onChange={set} rows={2} />

          <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
            Filamento {money(preview.filament)} · Energia {money(preview.energy)} · Depreciação {money(preview.machine)} ·
            Mão de obra {money(preview.labor)} · Embalagem {money(preview.packaging)} · Entrega {money(preview.delivery)}
            {preview.custom > 0 && <> · Personalizados {money(preview.custom)}</>} = <b>Total {money(preview.total)}</b>
          </div>
        </div>
      </Modal>

      {/* ───── Modal produzir lote ───── */}
      <Modal
        open={!!produce}
        onClose={() => setProduce(null)}
        title={`Produzir lote — ${produce?.name || ''}`}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setProduce(null)}>Cancelar</button>
            <button className="btn-primary" onClick={doProduce}>Confirmar produção</button>
          </>
        }
      >
        {produce && (
          <div className="space-y-3">
            <Input label="Quantidade produzida nesse lote" inputMode="numeric" value={produceQty}
              onChange={(e) => setProduceQty(e.target.value)} autoFocus />
            <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
              <p className="mb-1.5 font-semibold text-slate-700 dark:text-slate-200">Vai descontar das bobinas:</p>
              {(produce.slots || []).map((s, i) => {
                const spool = spoolsById[s.spoolId];
                const need = (Number(s.grams) || 0) * toNum(produceQty);
                const insufficient = spool && (Number(spool.currentWeight) || 0) < need;
                return (
                  <p key={i} className={`flex items-center gap-1.5 text-xs ${insufficient ? 'font-semibold text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                    <ColorDot hex={spool?.colorHex} size={10} />
                    {spool ? `${spool.material} ${spool.colorName}` : '—'}: {grams(need)}
                    {insufficient && ` — apenas ${grams(spool.currentWeight)} disponível!`}
                  </p>
                );
              })}
            </div>
            <p className="text-xs text-slate-400">
              Estoque atual: {produce.stockQty || 0} un. → após confirmar: {(Number(produce.stockQty) || 0) + toNum(produceQty)} un.
            </p>
          </div>
        )}
      </Modal>

      {/* ───── Modal ajustar estoque ───── */}
      <Modal
        open={!!adjust}
        onClose={() => setAdjust(null)}
        title="Ajustar Quantidade"
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAdjust(null)}>Cancelar</button>
            <button className="btn-primary" onClick={doAdjust}>Guardar</button>
          </>
        }
      >
        {adjust && (
          <div className="space-y-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">{adjust.name}</p>
            <Input inputMode="numeric" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} autoFocus
              hint="Correção manual — não desconta filamento. Para produção nova, use “Produzir lote”." />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Excluir produto"
        message={`Excluir "${confirm?.name}"? O histórico de vendas já registradas permanece no sistema.`}
        onConfirm={async () => {
          await api.remove('products', confirm.id, confirm.name);
          toast('Produto excluído.');
        }}
      />
    </div>
  );
}
