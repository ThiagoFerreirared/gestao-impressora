import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellOff, History, Package, Pencil, Plus, RotateCw, Scale, Trash2 } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import DataTable from '../components/ui/DataTable';
import Tabs from '../components/ui/Tabs';
import StatusBadge, { ColorDot } from '../components/ui/Badge';
import { Checkbox, ColorField, FormGrid, Input, Select, Textarea } from '../components/ui/Field';
import { DIAMETERS, FINISHES, SPOOL_STATUS, SPOOL_WEIGHTS } from '../lib/constants';
import { costPerGram, spoolStatus } from '../lib/calculations';
import { addSpoolWithExpense, adjustSpoolWeight, restockSpool } from '../lib/ops';
import { dateBR, dateTimeBR, grams, money, todayInput, toNum } from '../lib/format';

const EMPTY = {
  brand: '',
  material: '',
  colorName: '',
  colorHex: '#22c55e',
  finish: 'Basic',
  diameter: '1.75',
  initialWeight: '1000',
  currentWeight: '',
  price: '',
  supplier: '',
  purchaseDate: todayInput(),
  batch: '',
  location: '',
  alertThreshold: '',
  reorderPlaced: false,
  notes: '',
};

export default function Filaments() {
  const { spools, projects, settings, api, materialNames, brandNames, suppliers, packagingItems } = useData();
  const toast = useToast();
  const [tab, setTab] = useState('bobinas');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [confirm, setConfirm] = useState(null);
  const [historySpool, setHistorySpool] = useState(null);
  const [restock, setRestock] = useState(null);
  const [restockForm, setRestockForm] = useState({ date: todayInput(), grams: '', price: '', supplier: '', logExpense: true });
  const [adjust, setAdjust] = useState(null);
  const [adjustWeight, setAdjustWeight] = useState('');

  const rows = useMemo(
    () => spools.map((s) => ({ ...s, _status: spoolStatus(s, projects) })),
    [spools, projects]
  );

  const set = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const openNew = () => {
    setForm({ ...EMPTY, alertThreshold: String(settings.lowStockDefault || 100) });
    setModal({});
  };

  const openEdit = (s) => {
    setForm({
      brand: s.brand || '',
      material: s.material || '',
      colorName: s.colorName || '',
      colorHex: s.colorHex || '#888888',
      finish: s.finish || 'Basic',
      diameter: s.diameter || '1.75',
      initialWeight: s.initialWeight ?? '',
      currentWeight: s.currentWeight ?? '',
      price: s.price ?? '',
      supplier: s.supplier || '',
      purchaseDate: s.purchaseDate || '',
      batch: s.batch || '',
      location: s.location || '',
      alertThreshold: s.alertThreshold ?? '',
      reorderPlaced: !!s.reorderPlaced,
      notes: s.notes || '',
    });
    setModal({ id: s.id });
  };

  const save = async () => {
    if (!form.material) return toast('Selecione o material.', 'warning');
    if (!form.colorName.trim()) return toast('Informe a cor.', 'warning');
    const data = {
      brand: form.brand || 'Sem marca',
      material: form.material,
      colorName: form.colorName.trim(),
      colorHex: form.colorHex,
      finish: form.finish,
      diameter: form.diameter,
      initialWeight: toNum(form.initialWeight),
      currentWeight: form.currentWeight === '' ? toNum(form.initialWeight) : toNum(form.currentWeight),
      price: toNum(form.price),
      supplier: form.supplier,
      purchaseDate: form.purchaseDate,
      batch: form.batch,
      location: form.location,
      alertThreshold: toNum(form.alertThreshold) || settings.lowStockDefault || 100,
      reorderPlaced: form.reorderPlaced,
      notes: form.notes,
    };
    if (data.initialWeight <= 0) return toast('Peso original deve ser maior que zero.', 'warning');
    try {
      if (modal.id) {
        await api.update('spools', modal.id, data, `${data.material} ${data.colorName}`);
        toast('Bobina atualizada.');
      } else {
        await addSpoolWithExpense(api, data);
        toast('Bobina cadastrada e despesa lançada no Financeiro.');
      }
      setModal(null);
    } catch (err) {
      toast(`Erro ao salvar: ${err.message}`, 'error');
    }
  };

  const toggleReorder = async (s) => {
    await api.update('spools', s.id, { reorderPlaced: !s.reorderPlaced }, `${s.material} ${s.colorName}`);
    toast(s.reorderPlaced ? 'Alerta reativado.' : 'Pedido marcado — alerta silenciado até a reposição.');
  };

  const doRestock = async () => {
    if (toNum(restockForm.grams) <= 0 && toNum(restockForm.price) <= 0)
      return toast('Informe a quantidade e/ou o preço da reposição.', 'warning');
    await restockSpool(api, restock, {
      ...restockForm,
      grams: toNum(restockForm.grams),
      price: toNum(restockForm.price),
    });
    toast('Reposição registrada.');
    setRestock(null);
    setRestockForm({ date: todayInput(), grams: '', price: '', supplier: '', logExpense: true });
  };

  const doAdjust = async () => {
    await adjustSpoolWeight(api, adjust, toNum(adjustWeight), 'Pesagem manual');
    toast('Peso ajustado.');
    setAdjust(null);
  };

  const columns = [
    {
      key: 'name',
      label: 'Bobina',
      sortValue: (r) => `${r.material} ${r.colorName}`,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <ColorDot hex={r.colorHex} size={16} />
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              {r.material} <span className="font-normal">— {r.colorName}</span>
            </p>
            <p className="text-xs text-slate-400">
              {r.brand} • {r.finish} • {r.diameter}mm {r.location && `• 📍 ${r.location}`}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'weight',
      label: 'Restante',
      sortValue: (r) => Number(r.currentWeight) || 0,
      render: (r) => {
        const pctLeft = r.initialWeight > 0 ? Math.max(0, Math.min(100, (r.currentWeight / r.initialWeight) * 100)) : 0;
        return (
          <div className="min-w-[110px]">
            <p className="text-sm font-semibold">{grams(r.currentWeight)} <span className="muted text-xs">/ {grams(r.initialWeight)}</span></p>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className={`h-full rounded-full ${pctLeft < 15 ? 'bg-red-500' : pctLeft < 35 ? 'bg-amber-500' : 'bg-green-500'}`}
                style={{ width: `${pctLeft}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: 'costG',
      label: 'Custo/g',
      sortValue: (r) => costPerGram(r),
      render: (r) => <span className="font-medium">{money(costPerGram(r))}</span>,
    },
    { key: 'price', label: 'Pago', sortValue: (r) => Number(r.price) || 0, render: (r) => money(r.price) },
    {
      key: 'status',
      label: 'Status',
      sortValue: (r) => r._status.status,
      render: (r) => (
        <div className="space-y-1">
          <StatusBadge map={SPOOL_STATUS} value={r._status.status} />
          {r.reorderPlaced && <span className="badge-purple block w-fit">Pedido feito</span>}
          {r._status.allocations.length > 0 && r._status.status === 'acabando' && (
            <p className="max-w-[180px] text-[11px] font-semibold leading-tight text-red-500">
              ⚠ alocada em{' '}
              {r._status.allocations.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && ', '}
                  <Link className="underline" to={`/projetos/${p.id}`} onClick={(e) => e.stopPropagation()}>
                    {p.name}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </div>
      ),
    },
    { key: 'purchaseDate', label: 'Compra', sortValue: (r) => r.purchaseDate || '', render: (r) => dateBR(r.purchaseDate) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Filamentos & Estoque</h1>
          <p className="muted text-sm">Bobinas com custo real por grama, alertas e histórico de consumo</p>
        </div>
        {tab === 'bobinas' && (
          <button className="btn-primary" onClick={openNew}>
            <Plus size={16} /> Nova bobina
          </button>
        )}
      </div>

      <Tabs
        tabs={[
          { key: 'bobinas', label: 'Bobinas', count: spools.length },
          { key: 'insumos', label: 'Insumos de embalagem', count: packagingItems.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'bobinas' ? (
        <DataTable
          data={rows}
          searchKeys={['material', 'colorName', 'brand', 'supplier', 'location', 'batch']}
          searchPlaceholder="Buscar por material, cor, marca, local..."
          filters={[
            {
              key: 'material',
              label: 'Material',
              options: [...new Set(spools.map((s) => s.material))].sort().map((m) => ({ value: m, label: m })),
            },
            {
              key: 'status',
              label: 'Status',
              options: Object.entries(SPOOL_STATUS).map(([value, v]) => ({ value, label: v.label })),
              fn: (r, v) => r._status.status === v,
            },
            {
              key: 'brand',
              label: 'Marca',
              options: [...new Set(spools.map((s) => s.brand))].sort().map((b) => ({ value: b, label: b })),
            },
          ]}
          columns={columns}
          initialSort={{ key: 'name', dir: 'asc' }}
          emptyTitle="Nenhuma bobina cadastrada"
          emptyMessage="Cadastre suas bobinas para controlar estoque e custo por grama."
          rowActions={(r) => (
            <>
              <button className="btn-icon" title="Histórico" onClick={() => setHistorySpool(r)}>
                <History size={15} />
              </button>
              <button className="btn-icon" title="Registrar reposição" onClick={() => setRestock(r)}>
                <RotateCw size={15} />
              </button>
              <button className="btn-icon" title="Ajustar peso (balança)" onClick={() => { setAdjust(r); setAdjustWeight(String(r.currentWeight ?? '')); }}>
                <Scale size={15} />
              </button>
              <button
                className="btn-icon"
                title={r.reorderPlaced ? 'Reativar alerta' : 'Marcar pedido feito (silencia alerta)'}
                onClick={() => toggleReorder(r)}
              >
                {r.reorderPlaced ? <BellOff size={15} /> : <Bell size={15} />}
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
      ) : (
        <PackagingTab />
      )}

      {/* ───── Modal bobina ───── */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.id ? 'Editar bobina' : 'Nova bobina'}
        size="lg"
        footer={
          <>
            <span className="mr-auto text-xs text-slate-400">
              Custo/g:{' '}
              <b className="text-blue-500">
                {toNum(form.initialWeight) > 0 ? money(toNum(form.price) / toNum(form.initialWeight)) : '—'}
              </b>
            </span>
            <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-primary" onClick={save}>Salvar</button>
          </>
        }
      >
        <FormGrid cols={2}>
          <Select label="Marca" name="brand" value={form.brand} onChange={set} placeholder="Selecionar..."
            options={brandNames} hint="Marcas personalizadas: Configurações" />
          <Select label="Material *" name="material" value={form.material} onChange={set} placeholder="Selecionar..."
            options={materialNames} hint="Materiais personalizados: Configurações ou Biblioteca" />
          <ColorField label="Cor *" name="colorName" hexName="colorHex" value={form.colorName} hexValue={form.colorHex} onChange={set} />
          <Select label="Acabamento" name="finish" value={form.finish} onChange={set} options={FINISHES} />
          <Select label="Diâmetro" name="diameter" value={form.diameter} onChange={set}
            options={DIAMETERS.map((d) => ({ value: d, label: `${d} mm` }))} />
          <Select label="Peso original (g)" name="initialWeight" value={form.initialWeight} onChange={set}
            options={SPOOL_WEIGHTS.map((w) => ({ value: String(w), label: `${w} g` }))} />
          <Input label="Peso atual restante (g)" name="currentWeight" inputMode="decimal" value={form.currentWeight}
            onChange={set} placeholder="vazio = peso original" hint="Descontado automaticamente a cada impressão" />
          <Input label="Preço pago (R$)" name="price" inputMode="decimal" value={form.price} onChange={set} />
          <Select label="Fornecedor" name="supplier" value={form.supplier} onChange={set} placeholder="Selecionar..."
            options={[...new Set([...suppliers.map((s) => s.name), form.supplier].filter(Boolean))]} hint="Cadastre fornecedores na Biblioteca" />
          <Input label="Data de compra" type="date" name="purchaseDate" value={form.purchaseDate} onChange={set} />
          <Input label="Lote / NF (opcional)" name="batch" value={form.batch} onChange={set} />
          <Input label="Localização física" name="location" value={form.location} onChange={set} placeholder="Ex: prateleira A, gaveta 2" />
          <Input label="Limite de alerta (g)" name="alertThreshold" inputMode="numeric" value={form.alertThreshold}
            onChange={set} hint={`Abaixo disso vira "Acabando" (padrão ${settings.lowStockDefault}g)`} />
          <div className="flex items-end pb-1">
            <Checkbox label="Pedido de reposição já feito (silencia alerta)" name="reorderPlaced" checked={form.reorderPlaced} onChange={set} />
          </div>
        </FormGrid>
        <div className="mt-3.5">
          <Textarea label="Observações" name="notes" value={form.notes} onChange={set}
            placeholder="Ex: boa adesão, resseca rápido, usar logo..." />
        </div>
      </Modal>

      {/* ───── Modal histórico ───── */}
      <Modal
        open={!!historySpool}
        onClose={() => setHistorySpool(null)}
        title={historySpool ? `Histórico — ${historySpool.material} ${historySpool.colorName}` : ''}
        size="lg"
      >
        {historySpool && (
          <div className="space-y-5">
            <div>
              <h4 className="section-title mb-2">Consumo</h4>
              {(historySpool.usageHistory || []).length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum consumo registrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr><th>Data</th><th>Projeto</th><th>Tipo</th><th>Gramas</th><th>Custo</th><th>Restante</th></tr>
                    </thead>
                    <tbody>
                      {[...historySpool.usageHistory].reverse().map((h) => (
                        <tr key={h.id}>
                          <td className="whitespace-nowrap">{dateTimeBR(h.date)}</td>
                          <td>
                            {h.projectId ? (
                              <Link to={`/projetos/${h.projectId}`} className="text-blue-500 hover:underline">
                                {h.projectName}
                              </Link>
                            ) : (
                              h.projectName
                            )}
                            {h.partName && <span className="muted text-xs"> — {h.partName}</span>}
                          </td>
                          <td>
                            <span className={h.type === 'falha' ? 'badge-red' : h.type === 'ajuste' ? 'badge-gray' : 'badge-green'}>
                              {h.type}
                            </span>
                          </td>
                          <td>{grams(h.grams)}</td>
                          <td>{money(h.cost)}</td>
                          <td>{grams(h.remainingAfter)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div>
              <h4 className="section-title mb-2">Reposições</h4>
              {(historySpool.restocks || []).length === 0 ? (
                <p className="text-sm text-slate-400">Nenhuma reposição registrada.</p>
              ) : (
                <table className="table-base">
                  <thead><tr><th>Data</th><th>Quantidade</th><th>Preço</th><th>Fornecedor</th></tr></thead>
                  <tbody>
                    {[...historySpool.restocks].reverse().map((r) => (
                      <tr key={r.id}>
                        <td>{dateBR(r.date)}</td>
                        <td>{grams(r.grams)}</td>
                        <td>{money(r.price)}</td>
                        <td>{r.supplier || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ───── Modal reposição ───── */}
      <Modal
        open={!!restock}
        onClose={() => setRestock(null)}
        title={restock ? `Reposição — ${restock.material} ${restock.colorName}` : ''}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setRestock(null)}>Cancelar</button>
            <button className="btn-primary" onClick={doRestock}>Registrar</button>
          </>
        }
      >
        <div className="space-y-3.5">
          <Input label="Data" type="date" value={restockForm.date}
            onChange={(e) => setRestockForm((f) => ({ ...f, date: e.target.value }))} />
          <Input label="Quantidade (g)" inputMode="decimal" value={restockForm.grams}
            onChange={(e) => setRestockForm((f) => ({ ...f, grams: e.target.value }))}
            hint="Somada ao peso atual da bobina" />
          <Input label="Preço pago (R$)" inputMode="decimal" value={restockForm.price}
            onChange={(e) => setRestockForm((f) => ({ ...f, price: e.target.value }))} />
          <Input label="Fornecedor" value={restockForm.supplier}
            onChange={(e) => setRestockForm((f) => ({ ...f, supplier: e.target.value }))} />
          <Checkbox label="Lançar despesa no Financeiro" checked={restockForm.logExpense}
            onChange={(e) => setRestockForm((f) => ({ ...f, logExpense: e.target.checked }))} />
        </div>
      </Modal>

      {/* ───── Modal ajuste de peso ───── */}
      <Modal
        open={!!adjust}
        onClose={() => setAdjust(null)}
        title={adjust ? `Ajustar peso — ${adjust.material} ${adjust.colorName}` : ''}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAdjust(null)}>Cancelar</button>
            <button className="btn-primary" onClick={doAdjust}>Ajustar</button>
          </>
        }
      >
        <Input label="Peso atual real (g)" inputMode="decimal" value={adjustWeight}
          onChange={(e) => setAdjustWeight(e.target.value)}
          hint="Pese a bobina (descontando o carretel, ~250g no padrão Bambu) e informe o valor real" />
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Excluir bobina"
        message={`Excluir "${confirm?.material} ${confirm?.colorName}"? O histórico de consumo dela será perdido.`}
        onConfirm={async () => {
          await api.remove('spools', confirm.id, `${confirm.material} ${confirm.colorName}`);
          toast('Bobina excluída.');
        }}
      />
    </div>
  );
}

// ───────────────────────── Insumos de embalagem ─────────────────────────

const EMPTY_ITEM = { name: '', quantity: '', minQuantity: '', unitCost: '', supplier: '', notes: '' };

function PackagingTab() {
  const { packagingItems, api } = useData();
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_ITEM);
  const [confirm, setConfirm] = useState(null);

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const save = async () => {
    if (!form.name.trim()) return toast('Informe o nome do insumo.', 'warning');
    const data = {
      name: form.name.trim(),
      quantity: toNum(form.quantity),
      minQuantity: toNum(form.minQuantity),
      unitCost: toNum(form.unitCost),
      supplier: form.supplier,
      notes: form.notes,
    };
    if (modal.id) await api.update('packagingItems', modal.id, data);
    else await api.add('packagingItems', data);
    toast('Insumo salvo.');
    setModal(null);
  };

  return (
    <>
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => { setForm(EMPTY_ITEM); setModal({}); }}>
          <Plus size={16} /> Novo insumo
        </button>
      </div>
      <DataTable
        data={packagingItems}
        searchKeys={['name', 'supplier']}
        searchPlaceholder="Buscar insumo..."
        columns={[
          {
            key: 'name',
            label: 'Insumo',
            sortValue: (r) => r.name,
            render: (r) => (
              <span className="flex items-center gap-2 font-semibold">
                <Package size={15} className="text-slate-400" /> {r.name}
              </span>
            ),
          },
          {
            key: 'quantity',
            label: 'Estoque',
            sortValue: (r) => Number(r.quantity) || 0,
            render: (r) => (
              <span className={Number(r.quantity) <= Number(r.minQuantity) ? 'badge-red' : 'badge-green'}>
                {r.quantity} un {Number(r.quantity) <= Number(r.minQuantity) && '• repor!'}
              </span>
            ),
          },
          { key: 'minQuantity', label: 'Mínimo', render: (r) => `${r.minQuantity} un` },
          { key: 'unitCost', label: 'Custo un.', render: (r) => money(r.unitCost) },
          { key: 'supplier', label: 'Fornecedor', render: (r) => r.supplier || '—' },
        ]}
        emptyTitle="Nenhum insumo cadastrado"
        emptyMessage="Caixas, fita, papel bolha... controle aqui o estoque de embalagem."
        rowActions={(r) => (
          <>
            <button
              className="btn-icon"
              title="Editar"
              onClick={() => {
                setForm({
                  name: r.name, quantity: r.quantity ?? '', minQuantity: r.minQuantity ?? '',
                  unitCost: r.unitCost ?? '', supplier: r.supplier || '', notes: r.notes || '',
                });
                setModal({ id: r.id });
              }}
            >
              <Pencil size={15} />
            </button>
            <button className="btn-icon hover:!text-red-500" title="Excluir" onClick={() => setConfirm(r)}>
              <Trash2 size={15} />
            </button>
          </>
        )}
      />

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.id ? 'Editar insumo' : 'Novo insumo de embalagem'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-primary" onClick={save}>Salvar</button>
          </>
        }
      >
        <FormGrid cols={2}>
          <Input label="Nome *" name="name" value={form.name} onChange={set} placeholder="Ex: Caixa 20x20x10" />
          <Input label="Quantidade em estoque" name="quantity" inputMode="numeric" value={form.quantity} onChange={set} />
          <Input label="Quantidade mínima" name="minQuantity" inputMode="numeric" value={form.minQuantity} onChange={set} />
          <Input label="Custo unitário (R$)" name="unitCost" inputMode="decimal" value={form.unitCost} onChange={set} />
          <Input label="Fornecedor" name="supplier" value={form.supplier} onChange={set} />
        </FormGrid>
        <div className="mt-3.5">
          <Textarea label="Observações" name="notes" value={form.notes} onChange={set} />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Excluir insumo"
        message={`Excluir "${confirm?.name}"?`}
        onConfirm={async () => {
          await api.remove('packagingItems', confirm.id, confirm.name);
          toast('Insumo excluído.');
        }}
      />
    </>
  );
}
