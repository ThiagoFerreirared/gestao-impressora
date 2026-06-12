import { useMemo, useState } from 'react';
import { BadgeDollarSign, Pencil, Plus, Trash2 } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import DataTable from '../components/ui/DataTable';
import StatusBadge from '../components/ui/Badge';
import SearchSelect from '../components/ui/SearchSelect';
import { FormGrid, Input, Select, Textarea } from '../components/ui/Field';
import { ORDER_STATUS, PAYMENT_METHODS, PAYMENT_STATUS } from '../lib/constants';
import { projectPrices } from '../lib/calculations';
import { markOrderPaid, orderTotal } from '../lib/ops';
import { dateBR, money, orderNumber, todayInput, toNum } from '../lib/format';

const EMPTY = {
  clientId: '',
  deliveryDate: '',
  paymentMethod: 'Pix',
  paymentStatus: 'pendente',
  status: 'aberto',
  discount: '',
  notes: '',
  items: [],
};

export default function Orders() {
  const { orders, clients, clientsById, projects, projectsById, spoolsById, printersById, settings, api } = useData();
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [confirm, setConfirm] = useState(null);

  const ctx = { spoolsById, printersById, settings };

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const openNew = () => {
    setForm({ ...EMPTY, deliveryDate: todayInput() });
    setModal({});
  };

  const openEdit = (o) => {
    setForm({
      clientId: o.clientId || '',
      deliveryDate: o.deliveryDate || '',
      paymentMethod: o.paymentMethod || 'Pix',
      paymentStatus: o.paymentStatus || 'pendente',
      status: o.status || 'aberto',
      discount: String(o.discount ?? ''),
      notes: o.notes || '',
      items: (o.items || []).map((i) => ({ ...i, qty: String(i.qty ?? 1), unitPrice: String(i.unitPrice ?? '') })),
    });
    setModal({ id: o.id, order: o });
  };

  const addItem = (projectId) => {
    const project = projectsById[projectId];
    const price = project ? projectPrices(project, ctx).finalPrice : 0;
    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        {
          projectId: projectId || '',
          description: project?.name || '',
          qty: '1',
          unitPrice: price ? price.toFixed(2) : '',
        },
      ],
    }));
  };

  const updateItem = (i, patch) =>
    setForm((f) => ({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

  const removeItem = (i) => setForm((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }));

  const formTotal = useMemo(() => {
    const items = form.items.reduce((a, i) => a + toNum(i.qty) * toNum(i.unitPrice), 0);
    return Math.max(0, items - toNum(form.discount));
  }, [form]);

  const save = async () => {
    if (form.items.length === 0) return toast('Adicione pelo menos um item ao pedido.', 'warning');
    const data = {
      clientId: form.clientId,
      deliveryDate: form.deliveryDate,
      paymentMethod: form.paymentMethod,
      paymentStatus: form.paymentStatus,
      status: form.status,
      discount: toNum(form.discount),
      notes: form.notes,
      items: form.items
        .filter((i) => i.description.trim())
        .map((i) => ({
          projectId: i.projectId || '',
          description: i.description.trim(),
          qty: toNum(i.qty) || 1,
          unitPrice: toNum(i.unitPrice),
        })),
    };
    try {
      if (modal.id) {
        await api.update('orders', modal.id, data, modal.order.number);
        toast('Pedido atualizado.');
      } else {
        data.number = orderNumber(orders.length);
        data.revenueLogged = false;
        await api.add('orders', data, data.number);
        toast(`Pedido ${data.number} criado.`);
      }
      setModal(null);
    } catch (err) {
      toast(`Erro: ${err.message}`, 'error');
    }
  };

  const pay = async (order) => {
    await markOrderPaid(api, order, clientsById[order.clientId]?.name);
    toast('Pedido marcado como pago — receita lançada no Financeiro.');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Pedidos</h1>
          <p className="muted text-sm">Vendas com projetos incluídos, pagamento e entrega</p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus size={16} /> Novo pedido
        </button>
      </div>

      <DataTable
        data={orders}
        searchKeys={['number', (r) => clientsById[r.clientId]?.name || '', (r) => (r.items || []).map((i) => i.description).join(' ')]}
        searchPlaceholder="Buscar por número, cliente, item..."
        filters={[
          { key: 'status', label: 'Status', options: Object.entries(ORDER_STATUS).map(([value, v]) => ({ value, label: v.label })) },
          { key: 'paymentStatus', label: 'Pagamento', options: Object.entries(PAYMENT_STATUS).map(([value, v]) => ({ value, label: v.label })) },
        ]}
        columns={[
          {
            key: 'number',
            label: 'Pedido',
            sortValue: (r) => r.number,
            render: (r) => (
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-100">{r.number}</p>
                <p className="text-xs text-slate-400">
                  {(r.items || []).map((i) => `${i.qty}× ${i.description}`).join(', ')}
                </p>
              </div>
            ),
          },
          {
            key: 'client',
            label: 'Cliente',
            sortValue: (r) => clientsById[r.clientId]?.name || '',
            render: (r) => clientsById[r.clientId]?.name || <span className="muted">—</span>,
          },
          { key: 'deliveryDate', label: 'Entrega', sortValue: (r) => r.deliveryDate || '', render: (r) => dateBR(r.deliveryDate) },
          { key: 'status', label: 'Status', sortValue: (r) => r.status, render: (r) => <StatusBadge map={ORDER_STATUS} value={r.status} /> },
          {
            key: 'paymentStatus',
            label: 'Pagamento',
            sortValue: (r) => r.paymentStatus,
            render: (r) => (
              <div className="space-y-0.5">
                <StatusBadge map={PAYMENT_STATUS} value={r.paymentStatus} />
                <p className="text-[11px] text-slate-400">{r.paymentMethod}</p>
              </div>
            ),
          },
          {
            key: 'total',
            label: 'Total',
            sortValue: (r) => orderTotal(r),
            render: (r) => (
              <div>
                <span className="font-bold text-green-500">{money(orderTotal(r))}</span>
                {Number(r.discount) > 0 && <p className="text-[11px] text-slate-400">desc. {money(r.discount)}</p>}
              </div>
            ),
          },
        ]}
        initialSort={{ key: 'number', dir: 'desc' }}
        emptyTitle="Nenhum pedido ainda"
        emptyMessage="Crie pedidos vinculando seus projetos e acompanhe pagamento e entrega."
        rowActions={(r) => (
          <>
            {r.paymentStatus !== 'pago' && (
              <button className="btn-icon !text-green-500" title="Marcar como pago (lança receita)" onClick={() => pay(r)}>
                <BadgeDollarSign size={16} />
              </button>
            )}
            <button className="btn-icon" title="Editar" onClick={() => openEdit(r)}>
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
        title={modal?.id ? `Editar pedido ${modal.order.number}` : 'Novo pedido'}
        size="lg"
        footer={
          <>
            <span className="mr-auto text-sm">
              Total: <b className="text-green-500">{money(formTotal)}</b>
            </span>
            <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-primary" onClick={save}>Salvar pedido</button>
          </>
        }
      >
        <div className="space-y-4">
          <FormGrid cols={2}>
            <SearchSelect label="Cliente" value={form.clientId}
              onChange={(v) => setForm((f) => ({ ...f, clientId: v }))}
              options={clients.map((c) => ({ value: c.id, label: c.name, sublabel: c.whatsapp || c.phone }))}
              placeholder="Selecionar cliente..." />
            <Input label="Data de entrega" type="date" name="deliveryDate" value={form.deliveryDate} onChange={set} />
            <Select label="Forma de pagamento" name="paymentMethod" value={form.paymentMethod} onChange={set} options={PAYMENT_METHODS} />
            <Select label="Status do pagamento" name="paymentStatus" value={form.paymentStatus} onChange={set}
              options={Object.entries(PAYMENT_STATUS).map(([value, v]) => ({ value, label: v.label }))} />
            <Select label="Status do pedido" name="status" value={form.status} onChange={set}
              options={Object.entries(ORDER_STATUS).map(([value, v]) => ({ value, label: v.label }))} />
            <Input label="Desconto (R$)" name="discount" inputMode="decimal" value={form.discount} onChange={set} />
          </FormGrid>

          <div>
            <p className="label">Itens do pedido</p>
            <div className="space-y-2">
              {form.items.map((item, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                  <input className="input min-w-[140px] flex-1" placeholder="Descrição" value={item.description}
                    onChange={(e) => updateItem(i, { description: e.target.value })} />
                  <input className="input w-16" inputMode="numeric" placeholder="Qtd" value={item.qty}
                    onChange={(e) => updateItem(i, { qty: e.target.value })} />
                  <input className="input w-28" inputMode="decimal" placeholder="Preço un." value={item.unitPrice}
                    onChange={(e) => updateItem(i, { unitPrice: e.target.value })} />
                  <span className="w-24 text-right text-sm font-semibold">{money(toNum(item.qty) * toNum(item.unitPrice))}</span>
                  <button className="btn-icon" onClick={() => removeItem(i)}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <SearchSelect
                value=""
                onChange={(v) => v && addItem(v)}
                options={projects
                  .filter((p) => !p.isTest)
                  .map((p) => ({ value: p.id, label: p.name, sublabel: money(projectPrices(p, ctx).finalPrice) }))}
                placeholder="+ Adicionar projeto (preço sugerido automático)"
                allowClear={false}
              />
              <button className="btn-secondary btn-sm" onClick={() => addItem('')}>
                <Plus size={13} /> Item avulso
              </button>
            </div>
          </div>

          <Textarea label="Observações" name="notes" value={form.notes} onChange={set} rows={2} />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Excluir pedido"
        message={`Excluir o pedido ${confirm?.number}?`}
        onConfirm={async () => {
          await api.remove('orders', confirm.id, confirm.number);
          toast('Pedido excluído.');
        }}
      />
    </div>
  );
}
