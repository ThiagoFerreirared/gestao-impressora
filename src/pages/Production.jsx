import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Factory, Play, XCircle } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/ui/Modal';
import Tabs from '../components/ui/Tabs';
import StatusBadge, { ColorDot } from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { Checkbox, FormGrid, Input, Select, Textarea } from '../components/ui/Field';
import {
  ACTIVE_PROJECT_STATUSES,
  FAILURE_REASONS,
  PART_STATUS,
  PART_STATUS_FLOW,
  PRIORITIES,
  PROJECT_STATUS,
} from '../lib/constants';
import { completePart, registerFailure, setPartStatus, startPart } from '../lib/ops';
import { failureCost } from '../lib/calculations';
import {
  dateBR,
  dateTimeBR,
  durationInput,
  grams,
  hoursLabel,
  money,
  parseDuration,
  todayInput,
  toNum,
} from '../lib/format';

export default function Production() {
  const { projects, printers, printersById, spoolsById, settings, api } = useData();
  const toast = useToast();
  const [tab, setTab] = useState('fila');
  const [startModal, setStartModal] = useState(null); // {project, part}
  const [finishModal, setFinishModal] = useState(null);
  const [failModal, setFailModal] = useState(null);

  // Fila: partes não concluídas de projetos ativos, ordenadas por prioridade e prazo
  const queue = useMemo(() => {
    const items = [];
    for (const p of projects) {
      if (!ACTIVE_PROJECT_STATUSES.includes(p.status)) continue;
      for (const part of p.parts || []) {
        if (part.prodStatus === 'concluido') continue;
        items.push({ project: p, part });
      }
    }
    return items.sort((a, b) => {
      const pa = PRIORITIES[a.project.priority]?.order ?? 9;
      const pb = PRIORITIES[b.project.priority]?.order ?? 9;
      if (pa !== pb) return pa - pb;
      return (a.project.deadline || '9999') < (b.project.deadline || '9999') ? -1 : 1;
    });
  }, [projects]);

  const printing = queue.filter((i) => i.part.prodStatus === 'imprimindo');
  const done = useMemo(() => {
    const items = [];
    for (const p of projects) {
      for (const part of p.parts || []) {
        if (part.prodStatus === 'concluido') items.push({ project: p, part });
      }
    }
    return items.sort((a, b) => String(b.part.finishedAt || '').localeCompare(String(a.part.finishedAt || '')));
  }, [projects]);

  const advance = async (project, part) => {
    const idx = PART_STATUS_FLOW.indexOf(part.prodStatus);
    const next = PART_STATUS_FLOW[idx + 1];
    if (!next || next === 'imprimindo') return;
    await setPartStatus(api, project, part, next);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Produção</h1>
        <p className="muted text-sm">
          Fila de impressão ordenada por prioridade e prazo • {printing.length} imprimindo agora
        </p>
      </div>

      <Tabs
        tabs={[
          { key: 'fila', label: 'Fila', count: queue.length },
          { key: 'concluidas', label: 'Concluídas', count: done.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'fila' &&
        (queue.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Factory}
              title="Fila vazia"
              message='Projetos entram na fila quando o status é "Na fila", "Fatiando", "Imprimindo" ou "Pós-processo" e têm partes pendentes.'
            />
          </div>
        ) : (
          <div className="space-y-2.5">
            {queue.map(({ project, part }) => (
              <QueueItem
                key={`${project.id}-${part.id}`}
                project={project}
                part={part}
                printersById={printersById}
                spoolsById={spoolsById}
                onAdvance={() => advance(project, part)}
                onStart={() => setStartModal({ project, part })}
                onFinish={() => setFinishModal({ project, part })}
                onFail={() => setFailModal({ project, part })}
                onSetStatus={(s) => setPartStatus(api, project, part, s)}
              />
            ))}
          </div>
        ))}

      {tab === 'concluidas' && (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr><th>Projeto / Parte</th><th>Impressora</th><th>Concluída em</th><th>Tempo est. / real</th><th>Tentativas</th></tr>
            </thead>
            <tbody>
              {done.slice(0, 100).map(({ project, part }) => (
                <tr key={`${project.id}-${part.id}`}>
                  <td>
                    <Link to={`/projetos/${project.id}`} className="font-semibold text-blue-500 hover:underline">
                      {project.name}
                    </Link>{' '}
                    <span className="muted">— {part.name}</span>
                  </td>
                  <td>{printersById[part.printerId]?.name || '—'}</td>
                  <td className="whitespace-nowrap">{dateTimeBR(part.finishedAt)}</td>
                  <td className="whitespace-nowrap">
                    {hoursLabel(part.estMinutes)} /{' '}
                    <b className={part.realMinutes > part.estMinutes ? 'text-red-500' : 'text-green-500'}>
                      {hoursLabel(part.realMinutes)}
                    </b>
                  </td>
                  <td>{part.attempts || 1}</td>
                </tr>
              ))}
              {done.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-slate-400">Nenhuma impressão concluída ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {startModal && (
        <StartModal
          {...startModal}
          printers={printers}
          settings={settings}
          onClose={() => setStartModal(null)}
          onConfirm={async (printerId) => {
            await startPart(api, startModal.project, startModal.part, printerId);
            toast(`Impressão de "${startModal.part.name}" iniciada!`);
            setStartModal(null);
          }}
        />
      )}

      {finishModal && (
        <FinishModal
          {...finishModal}
          spoolsById={spoolsById}
          settings={settings}
          onClose={() => setFinishModal(null)}
          onConfirm={async (realMinutes) => {
            try {
              await completePart(api, {
                project: finishModal.project,
                part: finishModal.part,
                realMinutes,
                spoolsById,
                printersById,
              });
              toast('Impressão concluída! Filamento descontado das bobinas e horas somadas à impressora.');
              setFinishModal(null);
            } catch (err) {
              toast(`Erro: ${err.message}`, 'error');
            }
          }}
        />
      )}

      {failModal && (
        <FailModal
          {...failModal}
          spoolsById={spoolsById}
          printersById={printersById}
          settings={settings}
          onClose={() => setFailModal(null)}
          onConfirm={async (data) => {
            try {
              await registerFailure(api, {
                project: failModal.project,
                part: failModal.part,
                data,
                spoolsById,
                printersById,
                settings,
              });
              toast('Falha registrada: material descontado e custo calculado.', 'warning');
              setFailModal(null);
            } catch (err) {
              toast(`Erro: ${err.message}`, 'error');
            }
          }}
        />
      )}
    </div>
  );
}

// ───────────────────────── Item da fila ─────────────────────────

function QueueItem({ project, part, printersById, spoolsById, onAdvance, onStart, onFinish, onFail, onSetStatus }) {
  const printer = printersById[part.printerId];
  const overdue =
    project.deadline && project.deadline < todayInput() && !['concluido', 'entregue'].includes(project.status);

  return (
    <div className="card flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/projetos/${project.id}`} className="font-bold text-slate-900 hover:text-blue-500 dark:text-white">
            {project.name}
          </Link>
          <ChevronRight size={13} className="text-slate-400" />
          <span className="font-semibold">{part.name}</span>
          <StatusBadge map={PRIORITIES} value={project.priority} />
          <StatusBadge map={PROJECT_STATUS} value={project.status} />
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400">
          <span>⏱ {hoursLabel(part.estMinutes)}</span>
          <span>🖨 {printer?.name || 'sem impressora'}</span>
          <span className={overdue ? 'font-bold text-red-500' : ''}>📅 {dateBR(project.deadline)}</span>
          {part.attempts > 0 && <span>tentativas: {part.attempts}</span>}
          <span className="flex items-center gap-1">
            {(part.slots || []).map((s) => (
              <ColorDot key={s.slot} hex={spoolsById[s.spoolId]?.colorHex} size={11} />
            ))}
          </span>
        </p>
      </div>

      <div className="flex items-center gap-2">
        <select
          className="input w-auto !py-1.5 text-xs"
          value={part.prodStatus}
          onChange={(e) => onSetStatus(e.target.value)}
          title="Mover na fila"
        >
          {PART_STATUS_FLOW.filter((s) => s !== 'concluido').map((s) => (
            <option key={s} value={s}>{PART_STATUS[s].label}</option>
          ))}
        </select>

        {['pendente', 'fatiar'].includes(part.prodStatus) && (
          <button className="btn-secondary btn-sm" onClick={onAdvance}>
            Avançar <ChevronRight size={13} />
          </button>
        )}
        {part.prodStatus === 'pronto' && (
          <button className="btn-primary btn-sm" onClick={onStart}>
            <Play size={13} /> Iniciar
          </button>
        )}
        {part.prodStatus === 'imprimindo' && (
          <>
            <button className="btn-success btn-sm" onClick={onFinish}>
              <CheckCircle2 size={13} /> Concluir
            </button>
            <button className="btn-danger btn-sm" onClick={onFail}>
              <XCircle size={13} /> Falhou
            </button>
          </>
        )}
        {part.prodStatus === 'pos' && (
          <button className="btn-success btn-sm" onClick={onFinish}>
            <CheckCircle2 size={13} /> Concluir
          </button>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── Iniciar (com checklist pré-impressão) ─────────────────────────

function StartModal({ project, part, printers, settings, onClose, onConfirm }) {
  const [printerId, setPrinterId] = useState(part.printerId || printers[0]?.id || '');
  const [checked, setChecked] = useState({});
  const items = settings.preChecklist || [];

  return (
    <Modal
      open
      onClose={onClose}
      title={`Iniciar impressão — ${part.name}`}
      size="sm"
      footer={
        <>
          <span className="mr-auto text-xs text-slate-400">
            {Object.values(checked).filter(Boolean).length}/{items.length} verificados
          </span>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={() => onConfirm(printerId)}>
            <Play size={14} /> Iniciar agora
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Impressora"
          value={printerId}
          onChange={(e) => setPrinterId(e.target.value)}
          options={printers.map((p) => ({ value: p.id, label: `${p.name} (${p.status})` }))}
        />
        <div>
          <p className="label">Checklist pré-impressão</p>
          <div className="space-y-2">
            {items.map((item, i) => (
              <Checkbox key={i} label={item} checked={!!checked[i]}
                onChange={(e) => setChecked((c) => ({ ...c, [i]: e.target.checked }))} />
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-400">
          O início é registrado agora ({dateTimeBR(new Date())}) e conta como 1 tentativa.
        </p>
      </div>
    </Modal>
  );
}

// ───────────────────────── Concluir (desconta bobinas) ─────────────────────────

function FinishModal({ project, part, spoolsById, settings, onClose, onConfirm }) {
  const [realTime, setRealTime] = useState(durationInput(part.estMinutes));
  const [checked, setChecked] = useState({});
  const items = settings.postChecklist || [];

  const consumption = (part.slots || []).map((s) => {
    const spool = spoolsById[s.spoolId];
    const total = (Number(s.gramsPiece) || 0) + (Number(s.gramsPurge) || 0);
    return { slot: s.slot, spool, total, insufficient: spool && (Number(spool.currentWeight) || 0) < total };
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Concluir impressão — ${part.name}`}
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-success" onClick={() => onConfirm(parseDuration(realTime))}>
            <CheckCircle2 size={15} /> Concluir e descontar filamento
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Tempo real de impressão (hh:mm)"
          value={realTime}
          onChange={(e) => setRealTime(e.target.value)}
          hint={`Estimado: ${hoursLabel(part.estMinutes)} — o tempo real também soma horas de uso na impressora`}
        />

        {!part.consumed && consumption.length > 0 && (
          <div>
            <p className="label">Será descontado automaticamente das bobinas</p>
            <ul className="space-y-1.5">
              {consumption.map((c) => (
                <li key={c.slot} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                  <span className="flex items-center gap-2">
                    <b className="text-blue-500">S{c.slot}</b>
                    <ColorDot hex={c.spool?.colorHex} size={12} />
                    {c.spool ? `${c.spool.material} ${c.spool.colorName}` : 'bobina removida'}
                  </span>
                  <span className={c.insufficient ? 'font-bold text-red-500' : 'font-semibold'}>
                    −{grams(c.total)}
                    {c.insufficient && ' ⚠'}
                  </span>
                </li>
              ))}
            </ul>
            {consumption.some((c) => c.insufficient) && (
              <p className="mt-1.5 text-xs font-semibold text-red-500">
                ⚠ Alguma bobina não tem saldo suficiente — o estoque será zerado. Ajuste o peso depois se necessário.
              </p>
            )}
          </div>
        )}
        {part.consumed && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
            O filamento desta parte já foi descontado anteriormente — não será descontado de novo.
          </p>
        )}

        <div>
          <p className="label">Checklist pós-impressão</p>
          <div className="space-y-2">
            {items.map((item, i) => (
              <Checkbox key={i} label={item} checked={!!checked[i]}
                onChange={(e) => setChecked((c) => ({ ...c, [i]: e.target.checked }))} />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ───────────────────────── Registrar falha ─────────────────────────

function FailModal({ project, part, spoolsById, printersById, settings, onClose, onConfirm }) {
  const [form, setForm] = useState({
    reason: FAILURE_REASONS[0],
    reasonNote: '',
    lostTime: '',
    reprint: true,
    markProjectFailed: false,
    lost: (part.slots || []).map((s) => ({ slot: s.slot, spoolId: s.spoolId, grams: '' })),
  });

  const printer = printersById[part.printerId];
  const preview = failureCost({
    lostPerSlot: form.lost.map((l) => ({ ...l, grams: toNum(l.grams) })),
    lostMinutes: parseDuration(form.lostTime),
    printer,
    settings,
    spoolsById,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Registrar falha — ${part.name}`}
      size="md"
      footer={
        <>
          <span className="mr-auto text-sm">
            Custo da falha: <b className="text-red-500">{money(preview.total)}</b>
          </span>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            className="btn-danger"
            onClick={() =>
              onConfirm({
                reason: form.reason,
                reasonNote: form.reasonNote,
                lostMinutes: parseDuration(form.lostTime),
                lostPerSlot: form.lost.map((l) => ({ ...l, grams: toNum(l.grams) })),
                reprint: form.reprint,
                markProjectFailed: form.markProjectFailed,
              })
            }
          >
            <XCircle size={15} /> Registrar falha
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid cols={2}>
          <Select label="Motivo da falha" value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} options={FAILURE_REASONS} />
          <Input label="Tempo perdido (hh:mm)" value={form.lostTime}
            onChange={(e) => setForm((f) => ({ ...f, lostTime: e.target.value }))} placeholder="Ex: 2:30" />
        </FormGrid>
        <Textarea label="Detalhes (opcional)" value={form.reasonNote} rows={2}
          onChange={(e) => setForm((f) => ({ ...f, reasonNote: e.target.value }))} />

        <div>
          <p className="label">Filamento perdido por slot (g)</p>
          <div className="space-y-1.5">
            {form.lost.map((l, i) => {
              const spool = spoolsById[l.spoolId];
              return (
                <div key={l.slot} className="flex items-center gap-2">
                  <span className="flex w-44 items-center gap-1.5 text-sm">
                    <b className="text-blue-500">S{l.slot}</b>
                    <ColorDot hex={spool?.colorHex} size={11} />
                    <span className="truncate">{spool ? `${spool.material} ${spool.colorName}` : '—'}</span>
                  </span>
                  <input className="input flex-1" inputMode="decimal" placeholder="gramas perdidas" value={l.grams}
                    onChange={(e) => setForm((f) => ({ ...f, lost: f.lost.map((x, j) => (j === i ? { ...x, grams: e.target.value } : x)) }))} />
                </div>
              );
            })}
            {form.lost.length === 0 && <p className="text-sm text-slate-400">Esta parte não tem slots configurados.</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Checkbox label="Marcar para reimpressão (volta para a fila como Pronto p/ imprimir)" checked={form.reprint}
            onChange={(e) => setForm((f) => ({ ...f, reprint: e.target.checked, markProjectFailed: e.target.checked ? false : f.markProjectFailed }))} />
          {!form.reprint && (
            <Checkbox label="Marcar projeto inteiro como FALHOU" checked={form.markProjectFailed}
              onChange={(e) => setForm((f) => ({ ...f, markProjectFailed: e.target.checked }))} />
          )}
        </div>

        <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">
          Custo calculado: filamento {money(preview.filament)} + energia {money(preview.energy)} + máquina {money(preview.machine)}.
          O material perdido será descontado das bobinas e o tempo somado às horas da impressora.
        </div>
      </div>
    </Modal>
  );
}
