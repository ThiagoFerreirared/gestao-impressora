import { useState } from 'react';
import { Pencil, Plus, Printer as PrinterIcon, Trash2 } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import StatusBadge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { FormGrid, Input, Select, Textarea } from '../components/ui/Field';
import { MAINTENANCE_TYPES, PRINTER_STATUS } from '../lib/constants';
import { maintenanceDue, printerCostPerHour } from '../lib/calculations';
import { dateBR, fixed2, money, toNum, uid } from '../lib/format';

const EMPTY = {
  name: '',
  model: 'Bambu Lab A1 Combo',
  serial: '',
  purchaseDate: '',
  purchasePrice: '',
  lifespanHours: '5000',
  hoursUsed: '0',
  watts: '',
  status: 'ativa',
  notes: '',
};

export default function Printers() {
  const { printers, settings, api } = useData();
  const toast = useToast();
  const [modal, setModal] = useState(null); // {id?} | null
  const [form, setForm] = useState(EMPTY);
  const [confirm, setConfirm] = useState(null);

  const openNew = () => {
    setForm(EMPTY);
    setModal({});
  };

  const openEdit = (p) => {
    setForm({
      name: p.name || '',
      model: p.model || '',
      serial: p.serial || '',
      purchaseDate: p.purchaseDate || '',
      purchasePrice: p.purchasePrice ?? '',
      lifespanHours: p.lifespanHours ?? '',
      hoursUsed: p.hoursUsed ?? '0',
      watts: p.watts ?? '',
      status: p.status || 'ativa',
      notes: p.notes || '',
    });
    setModal({ id: p.id });
  };

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const save = async () => {
    if (!form.name.trim()) return toast('Informe o nome da impressora.', 'warning');
    const data = {
      name: form.name.trim(),
      model: form.model.trim(),
      serial: form.serial.trim(),
      purchaseDate: form.purchaseDate,
      purchasePrice: toNum(form.purchasePrice),
      lifespanHours: toNum(form.lifespanHours),
      hoursUsed: toNum(form.hoursUsed),
      watts: toNum(form.watts) || null,
      status: form.status,
      notes: form.notes,
    };
    try {
      if (modal.id) {
        await api.update('printers', modal.id, data);
        toast('Impressora atualizada.');
      } else {
        data.schedules = MAINTENANCE_TYPES.map((m) => ({
          id: uid(),
          type: m.type,
          intervalHours: m.intervalHours,
          lastDoneHours: data.hoursUsed,
          lastDoneDate: '',
        }));
        await api.add('printers', data);
        toast('Impressora cadastrada com agenda de manutenção padrão.');
      }
      setModal(null);
    } catch (err) {
      toast(`Erro ao salvar: ${err.message}`, 'error');
    }
  };

  const costHourPreview = toNum(form.lifespanHours) > 0 ? toNum(form.purchasePrice) / toNum(form.lifespanHours) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Impressoras</h1>
          <p className="muted text-sm">Cadastro, custo/hora e vida útil das suas máquinas</p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus size={16} /> Nova impressora
        </button>
      </div>

      {printers.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={PrinterIcon}
            title="Nenhuma impressora cadastrada"
            message="Cadastre sua Bambu Lab A1 Combo para começar a calcular custo/hora e agendar manutenções."
            action={
              <button className="btn-primary" onClick={openNew}>
                <Plus size={16} /> Cadastrar impressora
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {printers.map((p) => {
            const usagePct = p.lifespanHours > 0 ? Math.min(100, ((p.hoursUsed || 0) / p.lifespanHours) * 100) : 0;
            const due = maintenanceDue(p).filter((d) => d.level !== 'ok');
            return (
              <div key={p.id} className="card-pad space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-slate-900 dark:text-white">{p.name}</h3>
                    <p className="truncate text-xs text-slate-400">
                      {p.model} {p.serial && `• S/N ${p.serial}`}
                    </p>
                  </div>
                  <StatusBadge map={PRINTER_STATUS} value={p.status} />
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                  <span className="muted">Compra</span>
                  <span className="text-right font-medium">{money(p.purchasePrice)} <span className="muted text-xs">({dateBR(p.purchaseDate)})</span></span>
                  <span className="muted">Custo/hora</span>
                  <span className="text-right font-bold text-blue-500">{money(printerCostPerHour(p))}</span>
                  <span className="muted">Consumo</span>
                  <span className="text-right font-medium">{p.watts || settings.printerWattsDefault} W</span>
                  <span className="muted">Horas de uso</span>
                  <span className="text-right font-medium">
                    {fixed2(p.hoursUsed)} h / {p.lifespanHours || '—'} h
                  </span>
                </div>

                <div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full ${usagePct > 85 ? 'bg-red-500' : usagePct > 60 ? 'bg-amber-500' : 'bg-green-500'}`}
                      style={{ width: `${usagePct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">{usagePct.toFixed(1)}% da vida útil estimada</p>
                </div>

                {due.length > 0 && (
                  <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                    ⚠ {due.length} manutenção(ões) próxima(s)/vencida(s)
                  </p>
                )}

                {p.notes && <p className="text-xs text-slate-400">{p.notes}</p>}

                <div className="flex justify-end gap-1 border-t border-slate-100 pt-2 dark:border-slate-800">
                  <button className="btn-icon" onClick={() => openEdit(p)} title="Editar">
                    <Pencil size={15} />
                  </button>
                  <button className="btn-icon hover:!text-red-500" onClick={() => setConfirm(p)} title="Excluir">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.id ? 'Editar impressora' : 'Nova impressora'}
        size="lg"
        footer={
          <>
            <span className="mr-auto text-xs text-slate-400">
              Custo/hora calculado: <b className="text-blue-500">{money(costHourPreview)}</b>
            </span>
            <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-primary" onClick={save}>Salvar</button>
          </>
        }
      >
        <FormGrid cols={2}>
          <Input label="Nome *" name="name" value={form.name} onChange={set} placeholder="Ex: A1 da bancada" />
          <Input label="Modelo" name="model" value={form.model} onChange={set} />
          <Input label="Número de série (opcional)" name="serial" value={form.serial} onChange={set} />
          <Select label="Status" name="status" value={form.status} onChange={set}
            options={Object.entries(PRINTER_STATUS).map(([value, v]) => ({ value, label: v.label }))} />
          <Input label="Data de compra" type="date" name="purchaseDate" value={form.purchaseDate} onChange={set} />
          <Input label="Valor de compra (R$)" name="purchasePrice" inputMode="decimal" value={form.purchasePrice} onChange={set} placeholder="Ex: 4500" />
          <Input label="Vida útil estimada (horas)" name="lifespanHours" inputMode="numeric" value={form.lifespanHours} onChange={set}
            hint="Usada no cálculo do custo/hora (valor ÷ vida útil)" />
          <Input label="Horas totais de uso" name="hoursUsed" inputMode="decimal" value={form.hoursUsed} onChange={set}
            hint="Atualizado automaticamente a cada impressão concluída" />
          <Input label={`Consumo (W) — padrão ${settings.printerWattsDefault}W`} name="watts" inputMode="numeric" value={form.watts} onChange={set}
            hint="Deixe vazio para usar o padrão das Configurações" />
        </FormGrid>
        <div className="mt-3.5">
          <Textarea label="Observações" name="notes" value={form.notes} onChange={set} />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Excluir impressora"
        message={`Excluir "${confirm?.name}"? O histórico de manutenções permanece no sistema.`}
        onConfirm={async () => {
          await api.remove('printers', confirm.id, confirm.name);
          toast('Impressora excluída.');
        }}
      />
    </div>
  );
}
