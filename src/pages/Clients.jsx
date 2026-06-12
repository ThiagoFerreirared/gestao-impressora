import { useMemo, useState } from 'react';
import { AtSign, Mail, MapPin, Pencil, Phone, Plus, Trash2, Users } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import DataTable from '../components/ui/DataTable';
import StatusBadge from '../components/ui/Badge';
import { FormGrid, Input, Textarea } from '../components/ui/Field';
import { ORDER_STATUS, PAYMENT_STATUS } from '../lib/constants';
import { orderTotal } from '../lib/ops';
import { dateBR, money } from '../lib/format';

const EMPTY = { name: '', phone: '', whatsapp: '', instagram: '', email: '', address: '', notes: '' };

export default function Clients() {
  const { clients, orders, api } = useData();
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [confirm, setConfirm] = useState(null);
  const [detail, setDetail] = useState(null);

  const rows = useMemo(
    () =>
      clients.map((c) => {
        const clientOrders = orders.filter((o) => o.clientId === c.id && o.status !== 'cancelado');
        const totalPaid = clientOrders
          .filter((o) => o.paymentStatus === 'pago')
          .reduce((a, o) => a + orderTotal(o), 0);
        return { ...c, _orders: clientOrders, _count: clientOrders.length, _total: totalPaid };
      }),
    [clients, orders]
  );

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const save = async () => {
    if (!form.name.trim()) return toast('Informe o nome do cliente.', 'warning');
    const data = { ...form, name: form.name.trim() };
    if (modal.id) {
      await api.update('clients', modal.id, data);
      toast('Cliente atualizado.');
    } else {
      await api.add('clients', data);
      toast('Cliente cadastrado.');
    }
    setModal(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="muted text-sm">Cadastro, histórico de pedidos e valor total comprado</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm(EMPTY); setModal({}); }}>
          <Plus size={16} /> Novo cliente
        </button>
      </div>

      <DataTable
        data={rows}
        searchKeys={['name', 'phone', 'whatsapp', 'email', 'instagram']}
        searchPlaceholder="Buscar cliente..."
        columns={[
          {
            key: 'name',
            label: 'Cliente',
            sortValue: (r) => r.name,
            render: (r) => (
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100">{r.name}</p>
                <p className="flex flex-wrap gap-x-3 text-xs text-slate-400">
                  {r.whatsapp && <span className="inline-flex items-center gap-1"><Phone size={11} /> {r.whatsapp}</span>}
                  {r.instagram && <span className="inline-flex items-center gap-1"><AtSign size={11} /> {r.instagram}</span>}
                  {r.email && <span className="inline-flex items-center gap-1"><Mail size={11} /> {r.email}</span>}
                </p>
              </div>
            ),
          },
          { key: '_count', label: 'Pedidos', sortValue: (r) => r._count, render: (r) => r._count },
          {
            key: '_total',
            label: 'Total comprado',
            sortValue: (r) => r._total,
            render: (r) => <span className="font-bold text-green-500">{money(r._total)}</span>,
          },
        ]}
        initialSort={{ key: '_total', dir: 'desc' }}
        onRowClick={(r) => setDetail(r)}
        emptyTitle="Nenhum cliente cadastrado"
        rowActions={(r) => (
          <>
            <button className="btn-icon" title="Editar" onClick={() => { setForm({ ...EMPTY, ...r }); setModal({ id: r.id }); }}>
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
        title={modal?.id ? 'Editar cliente' : 'Novo cliente'}
        footer={<><button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
          <button className="btn-primary" onClick={save}>Salvar</button></>}
      >
        <FormGrid cols={2}>
          <Input label="Nome *" name="name" value={form.name} onChange={set} />
          <Input label="Telefone" name="phone" value={form.phone} onChange={set} />
          <Input label="WhatsApp" name="whatsapp" value={form.whatsapp} onChange={set} placeholder="(11) 99999-9999" />
          <Input label="Instagram" name="instagram" value={form.instagram} onChange={set} placeholder="@usuario" />
          <Input label="E-mail" type="email" name="email" value={form.email} onChange={set} />
          <Input label="Endereço (opcional)" name="address" value={form.address} onChange={set} />
        </FormGrid>
        <div className="mt-3.5">
          <Textarea label="Observações" name="notes" value={form.notes} onChange={set} />
        </div>
      </Modal>

      {/* Detalhe do cliente */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name} size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {detail.phone && <span className="inline-flex items-center gap-1.5"><Phone size={13} className="text-slate-400" /> {detail.phone}</span>}
              {detail.whatsapp && <span className="inline-flex items-center gap-1.5"><Phone size={13} className="text-green-500" /> {detail.whatsapp}</span>}
              {detail.instagram && <span className="inline-flex items-center gap-1.5"><AtSign size={13} className="text-pink-500" /> {detail.instagram}</span>}
              {detail.email && <span className="inline-flex items-center gap-1.5"><Mail size={13} className="text-slate-400" /> {detail.email}</span>}
              {detail.address && <span className="inline-flex items-center gap-1.5"><MapPin size={13} className="text-slate-400" /> {detail.address}</span>}
            </div>
            {detail.notes && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/50">{detail.notes}</p>}
            <div>
              <h4 className="section-title mb-2">Histórico de pedidos ({detail._count})</h4>
              {detail._orders.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum pedido ainda.</p>
              ) : (
                <table className="table-base">
                  <thead><tr><th>Pedido</th><th>Entrega</th><th>Status</th><th>Pagamento</th><th className="text-right">Valor</th></tr></thead>
                  <tbody>
                    {detail._orders.map((o) => (
                      <tr key={o.id}>
                        <td className="font-semibold">{o.number}</td>
                        <td>{dateBR(o.deliveryDate)}</td>
                        <td><StatusBadge map={ORDER_STATUS} value={o.status} /></td>
                        <td><StatusBadge map={PAYMENT_STATUS} value={o.paymentStatus} /></td>
                        <td className="text-right font-semibold">{money(orderTotal(o))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="mt-2 text-right text-sm">
                Total pago: <b className="text-green-500">{money(detail._total)}</b>
              </p>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Excluir cliente"
        message={`Excluir "${confirm?.name}"? Os pedidos dele permanecem no sistema.`}
        onConfirm={async () => {
          await api.remove('clients', confirm.id, confirm.name);
          toast('Cliente excluído.');
        }}
      />
    </div>
  );
}
