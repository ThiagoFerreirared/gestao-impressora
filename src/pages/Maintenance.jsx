import { useMemo, useState } from 'react';
import { CheckCircle2, Pencil, Plus, Trash2, Wrench } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import DataTable from '../components/ui/DataTable';
import Tabs from '../components/ui/Tabs';
import EmptyState from '../components/ui/EmptyState';
import { FormGrid, Input, Select, Textarea } from '../components/ui/Field';
import { MAINTENANCE_TYPES } from '../lib/constants';
import { maintenanceDue } from '../lib/calculations';
import { addMaintenanceRecord, clean } from '../lib/ops';
import { dateBR, fixed2, money, todayInput, toNum, uid as genId } from '../lib/format';

export default function Maintenance() {
  const { printers, printersById, projects, maintenanceRecords, maintenanceParts, api } = useData();
  const toast = useToast();
  const [tab, setTab] = useState('agenda');
  const [recordModal, setRecordModal] = useState(null); // {printer, type?}
  const [scheduleModal, setScheduleModal] = useState(null); // {printer}
  const [confirmRecord, setConfirmRecord] = useState(null);

  // Falhas recorrentes por impressora (a partir dos projetos)
  const failuresByPrinter = useMemo(() => {
    const acc = {};
    for (const p of projects) {
      for (const f of p.failures || []) {
        const key = f.printerId || 'sem';
        acc[key] = acc[key] || { count: 0, cost: 0, reasons: {} };
        acc[key].count += 1;
        acc[key].cost += Number(f.cost) || 0;
        acc[key].reasons[f.reason] = (acc[key].reasons[f.reason] || 0) + 1;
      }
    }
    return acc;
  }, [projects]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Manutenção</h1>
        <p className="muted text-sm">Preventivas por horas de uso, histórico e peças de reposição</p>
      </div>

      <Tabs
        tabs={[
          { key: 'agenda', label: 'Agenda preventiva' },
          { key: 'historico', label: 'Histórico', count: maintenanceRecords.length },
          { key: 'pecas', label: 'Peças de reposição', count: maintenanceParts.length },
          { key: 'falhas', label: 'Falhas por impressora' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {/* ───── Agenda ───── */}
      {tab === 'agenda' &&
        (printers.length === 0 ? (
          <div className="card">
            <EmptyState icon={Wrench} title="Cadastre uma impressora primeiro" message="A agenda de manutenção é criada automaticamente com cada impressora." />
          </div>
        ) : (
          <div className="space-y-4">
            {printers.map((p) => {
              const due = maintenanceDue(p);
              return (
                <div key={p.id} className="card-pad space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">{p.name}</h3>
                      <p className="text-xs text-slate-400">{fixed2(p.hoursUsed)} h de uso total</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-secondary btn-sm" onClick={() => setScheduleModal({ printer: p })}>
                        <Pencil size={13} /> Editar intervalos
                      </button>
                      <button className="btn-primary btn-sm" onClick={() => setRecordModal({ printer: p })}>
                        <Plus size={13} /> Registrar manutenção
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {due.map((s) => (
                      <div
                        key={s.id}
                        className={`rounded-xl border px-3 py-2.5 ${
                          s.level === 'overdue'
                            ? 'border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10'
                            : s.level === 'soon'
                              ? 'border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10'
                              : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{s.type}</p>
                          <button
                            className="btn-icon !h-7 !w-7 !text-green-500"
                            title="Marcar como feita agora"
                            onClick={() => setRecordModal({ printer: p, type: s.type })}
                          >
                            <CheckCircle2 size={15} />
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          a cada <b>{s.intervalHours}h</b> • última: {s.lastDoneDate ? dateBR(s.lastDoneDate) : '—'} ({fixed2(s.lastDoneHours)}h)
                        </p>
                        <p
                          className={`mt-1 text-xs font-bold ${
                            s.level === 'overdue' ? 'text-red-500' : s.level === 'soon' ? 'text-amber-500' : 'text-green-500'
                          }`}
                        >
                          {s.level === 'overdue'
                            ? `VENCIDA há ${Math.abs(Math.round(s.remaining))}h de uso`
                            : s.level === 'soon'
                              ? `Faltam ${Math.round(s.remaining)}h de uso`
                              : `OK — faltam ${Math.round(s.remaining)}h`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

      {/* ───── Histórico ───── */}
      {tab === 'historico' && (
        <>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={() => setRecordModal({ printer: printers[0] })} disabled={printers.length === 0}>
              <Plus size={16} /> Registrar manutenção
            </button>
          </div>
          <DataTable
            data={maintenanceRecords}
            searchKeys={['type', 'partReplaced', 'notes', (r) => printersById[r.printerId]?.name || '']}
            searchPlaceholder="Buscar manutenção..."
            filters={[
              { key: 'printerId', label: 'Impressora', options: printers.map((p) => ({ value: p.id, label: p.name })) },
              { key: 'type', label: 'Tipo', options: MAINTENANCE_TYPES.map((m) => ({ value: m.type, label: m.type })) },
            ]}
            columns={[
              { key: 'date', label: 'Data', sortValue: (r) => r.date || '', render: (r) => dateBR(r.date) },
              { key: 'printer', label: 'Impressora', render: (r) => printersById[r.printerId]?.name || '—' },
              { key: 'type', label: 'Tipo', sortValue: (r) => r.type, render: (r) => <span className="font-semibold">{r.type}</span> },
              { key: 'hoursAtMaintenance', label: 'Horas no momento', render: (r) => `${fixed2(r.hoursAtMaintenance)} h` },
              { key: 'partReplaced', label: 'Peça substituída', render: (r) => r.partReplaced || '—' },
              { key: 'cost', label: 'Custo', sortValue: (r) => Number(r.cost) || 0, render: (r) => money(r.cost) },
              { key: 'notes', label: 'Obs.', render: (r) => <span className="text-xs text-slate-400">{r.notes || '—'}</span> },
            ]}
            initialSort={{ key: 'date', dir: 'desc' }}
            emptyTitle="Nenhuma manutenção registrada"
            rowActions={(r) => (
              <button className="btn-icon hover:!text-red-500" title="Excluir" onClick={() => setConfirmRecord(r)}>
                <Trash2 size={15} />
              </button>
            )}
          />
        </>
      )}

      {/* ───── Peças ───── */}
      {tab === 'pecas' && <PartsStockTab />}

      {/* ───── Falhas ───── */}
      {tab === 'falhas' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {printers.map((p) => {
            const data = failuresByPrinter[p.id];
            return (
              <div key={p.id} className="card-pad">
                <h3 className="mb-2 font-bold text-slate-900 dark:text-white">{p.name}</h3>
                {!data ? (
                  <p className="text-sm text-slate-400">Nenhuma falha registrada 🎉</p>
                ) : (
                  <>
                    <p className="mb-2 text-sm">
                      <b className="text-red-500">{data.count}</b> falha(s) • prejuízo <b className="text-red-500">{money(data.cost)}</b>
                    </p>
                    <ul className="space-y-1">
                      {Object.entries(data.reasons)
                        .sort((a, b) => b[1] - a[1])
                        .map(([reason, count]) => (
                          <li key={reason} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm dark:bg-slate-800/50">
                            <span>{reason}</span>
                            <span className="badge-red">{count}×</span>
                          </li>
                        ))}
                    </ul>
                  </>
                )}
              </div>
            );
          })}
          {printers.length === 0 && (
            <div className="card lg:col-span-2">
              <EmptyState icon={Wrench} title="Sem impressoras cadastradas" />
            </div>
          )}
        </div>
      )}

      {recordModal && (
        <RecordModal
          printers={printers}
          initial={recordModal}
          onClose={() => setRecordModal(null)}
          onSave={async (printer, data) => {
            await addMaintenanceRecord(api, printer, data);
            toast('Manutenção registrada — agenda atualizada e despesa lançada (se houver custo).');
            setRecordModal(null);
          }}
        />
      )}

      {scheduleModal && (
        <ScheduleModal
          printer={scheduleModal.printer}
          onClose={() => setScheduleModal(null)}
          onSave={async (schedules) => {
            await api.update('printers', scheduleModal.printer.id, { schedules: clean(schedules) }, scheduleModal.printer.name);
            toast('Intervalos atualizados.');
            setScheduleModal(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmRecord}
        onClose={() => setConfirmRecord(null)}
        title="Excluir registro"
        message={`Excluir o registro "${confirmRecord?.type}" de ${dateBR(confirmRecord?.date)}?`}
        onConfirm={async () => {
          await api.remove('maintenanceRecords', confirmRecord.id, confirmRecord.type);
          toast('Registro excluído.');
        }}
      />
    </div>
  );
}

// ───────────────────────── Registrar manutenção ─────────────────────────

function RecordModal({ printers, initial, onClose, onSave }) {
  const [form, setForm] = useState({
    printerId: initial.printer?.id || printers[0]?.id || '',
    type: initial.type || MAINTENANCE_TYPES[0].type,
    date: todayInput(),
    hoursAtMaintenance: String(initial.printer?.hoursUsed ?? ''),
    partReplaced: '',
    cost: '',
    notes: '',
  });

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const printer = printers.find((p) => p.id === form.printerId);

  return (
    <Modal
      open
      onClose={onClose}
      title="Registrar manutenção realizada"
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            className="btn-primary"
            onClick={() =>
              onSave(printer, {
                printerId: form.printerId,
                type: form.type,
                date: form.date,
                hoursAtMaintenance: toNum(form.hoursAtMaintenance) || Number(printer?.hoursUsed) || 0,
                partReplaced: form.partReplaced,
                cost: toNum(form.cost),
                notes: form.notes,
              })
            }
          >
            Registrar
          </button>
        </>
      }
    >
      <FormGrid cols={2}>
        <Select label="Impressora" name="printerId" value={form.printerId}
          onChange={(e) => {
            const p = printers.find((x) => x.id === e.target.value);
            setForm((f) => ({ ...f, printerId: e.target.value, hoursAtMaintenance: String(p?.hoursUsed ?? '') }));
          }}
          options={printers.map((p) => ({ value: p.id, label: p.name }))} />
        <Select label="Tipo" name="type" value={form.type} onChange={set}
          options={[...MAINTENANCE_TYPES.map((m) => m.type), ...(MAINTENANCE_TYPES.some((m) => m.type === form.type) ? [] : [form.type])]} />
        <Input label="Data" type="date" name="date" value={form.date} onChange={set} />
        <Input label="Horas de uso no momento" name="hoursAtMaintenance" inputMode="decimal" value={form.hoursAtMaintenance} onChange={set}
          hint="Usado para reiniciar a contagem do intervalo" />
        <Input label="Peça substituída (opcional)" name="partReplaced" value={form.partReplaced} onChange={set} placeholder="Ex: nozzle 0.4" />
        <Input label="Custo (R$)" name="cost" inputMode="decimal" value={form.cost} onChange={set} hint="Lança despesa automática se > 0" />
      </FormGrid>
      <div className="mt-3.5">
        <Textarea label="Observações" name="notes" value={form.notes} onChange={set} rows={2} />
      </div>
    </Modal>
  );
}

// ───────────────────────── Editar intervalos ─────────────────────────

function ScheduleModal({ printer, onClose, onSave }) {
  const [schedules, setSchedules] = useState(
    (printer.schedules || []).map((s) => ({ ...s, intervalHours: String(s.intervalHours) }))
  );
  const [newType, setNewType] = useState('');

  return (
    <Modal
      open
      onClose={onClose}
      title={`Intervalos de manutenção — ${printer.name}`}
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary"
            onClick={() => onSave(schedules.map((s) => ({ ...s, intervalHours: toNum(s.intervalHours) })))}>
            Salvar
          </button>
        </>
      }
    >
      <div className="space-y-2">
        {schedules.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <span className="flex-1 text-sm font-medium">{s.type}</span>
            <input className="input w-24" inputMode="numeric" value={s.intervalHours}
              onChange={(e) => setSchedules((arr) => arr.map((x, j) => (j === i ? { ...x, intervalHours: e.target.value } : x)))} />
            <span className="text-xs text-slate-400">horas</span>
            <button className="btn-icon" onClick={() => setSchedules((arr) => arr.filter((_, j) => j !== i))}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <input className="input flex-1" placeholder="Nova manutenção personalizada..." value={newType}
            onChange={(e) => setNewType(e.target.value)} />
          <button
            className="btn-secondary btn-sm"
            onClick={() => {
              if (!newType.trim()) return;
              setSchedules((arr) => [
                ...arr,
                { id: genId(), type: newType.trim(), intervalHours: '200', lastDoneHours: Number(printer.hoursUsed) || 0, lastDoneDate: '' },
              ]);
              setNewType('');
            }}
          >
            <Plus size={13} /> Adicionar
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ───────────────────────── Peças de reposição ─────────────────────────

const EMPTY_PART = { name: '', code: '', quantity: '', minQuantity: '1', cost: '', supplier: '', notes: '' };

function PartsStockTab() {
  const { maintenanceParts, api } = useData();
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_PART);
  const [confirm, setConfirm] = useState(null);

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const save = async () => {
    if (!form.name.trim()) return toast('Informe o nome da peça.', 'warning');
    const data = {
      name: form.name.trim(),
      code: form.code,
      quantity: toNum(form.quantity),
      minQuantity: toNum(form.minQuantity),
      cost: toNum(form.cost),
      supplier: form.supplier,
      notes: form.notes,
    };
    if (modal.id) await api.update('maintenanceParts', modal.id, data);
    else await api.add('maintenanceParts', data);
    toast('Peça salva.');
    setModal(null);
  };

  return (
    <>
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => { setForm(EMPTY_PART); setModal({}); }}>
          <Plus size={16} /> Nova peça
        </button>
      </div>
      <DataTable
        data={maintenanceParts}
        searchKeys={['name', 'code', 'supplier']}
        searchPlaceholder="Buscar peça..."
        columns={[
          { key: 'name', label: 'Peça', sortValue: (r) => r.name, render: (r) => (
            <div>
              <p className="font-semibold">{r.name}</p>
              {r.code && <p className="text-xs text-slate-400">cód. {r.code}</p>}
            </div>
          )},
          {
            key: 'quantity', label: 'Estoque', sortValue: (r) => Number(r.quantity) || 0,
            render: (r) => (
              <span className={Number(r.quantity) <= Number(r.minQuantity) ? 'badge-red' : 'badge-green'}>
                {r.quantity} un {Number(r.quantity) <= Number(r.minQuantity) && '• repor!'}
              </span>
            ),
          },
          { key: 'cost', label: 'Custo un.', render: (r) => money(r.cost) },
          { key: 'supplier', label: 'Fornecedor', render: (r) => r.supplier || '—' },
          { key: 'notes', label: 'Obs.', render: (r) => <span className="text-xs text-slate-400">{r.notes || '—'}</span> },
        ]}
        emptyTitle="Nenhuma peça em estoque"
        emptyMessage="Nozzles, placas, tubos PTFE... mantenha o estoque de manutenção sob controle."
        rowActions={(r) => (
          <>
            <button className="btn-icon" title="Editar" onClick={() => {
              setForm({ name: r.name, code: r.code || '', quantity: String(r.quantity ?? ''), minQuantity: String(r.minQuantity ?? ''), cost: String(r.cost ?? ''), supplier: r.supplier || '', notes: r.notes || '' });
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

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? 'Editar peça' : 'Nova peça de reposição'}
        footer={<><button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
          <button className="btn-primary" onClick={save}>Salvar</button></>}>
        <FormGrid cols={2}>
          <Input label="Nome *" name="name" value={form.name} onChange={set} placeholder="Ex: Nozzle 0.4mm aço" />
          <Input label="Código (opcional)" name="code" value={form.code} onChange={set} />
          <Input label="Quantidade" name="quantity" inputMode="numeric" value={form.quantity} onChange={set} />
          <Input label="Quantidade mínima" name="minQuantity" inputMode="numeric" value={form.minQuantity} onChange={set} />
          <Input label="Custo unitário (R$)" name="cost" inputMode="decimal" value={form.cost} onChange={set} />
          <Input label="Fornecedor" name="supplier" value={form.supplier} onChange={set} />
        </FormGrid>
        <div className="mt-3.5">
          <Textarea label="Observações" name="notes" value={form.notes} onChange={set} rows={2} />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Excluir peça"
        message={`Excluir "${confirm?.name}"?`}
        onConfirm={async () => {
          await api.remove('maintenanceParts', confirm.id, confirm.name);
          toast('Peça excluída.');
        }}
      />
    </>
  );
}
