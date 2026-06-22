import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  Copy,
  ExternalLink,
  LayoutTemplate,
  Pencil,
  Plus,
  Snowflake,
  Trash2,
} from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Tabs from '../components/ui/Tabs';
import StatusBadge, { ColorDot } from '../components/ui/Badge';
import SearchSelect from '../components/ui/SearchSelect';
import { Checkbox, FormGrid, Input, Select, Textarea } from '../components/ui/Field';
import SlotEditor from '../components/domain/SlotEditor';
import {
  PART_STATUS,
  POST_STEPS,
  PRIORITIES,
  PROJECT_CATEGORIES,
  PROJECT_STATUS,
  PROJECT_STATUS_FLOW,
  QUALITY,
  TAG_COLORS,
} from '../lib/constants';
import { partFilament, projectCosts, projectPrices } from '../lib/calculations';
import { clean, duplicateProject, saveAsTemplate } from '../lib/ops';
import {
  dateBR,
  dateTimeBR,
  durationInput,
  grams,
  hoursLabel,
  money,
  parseDuration,
  pct,
  toNum,
  uid as genId,
} from '../lib/format';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { projectsById, clientsById, spools, spoolsById, printers, printersById, settings, api } = useData();
  const toast = useToast();
  const [tab, setTab] = useState('resumo');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const project = projectsById[id];
  const ctx = { spoolsById, printersById, settings };

  const estimated = useMemo(
    () => (project ? projectCosts(project, ctx, { real: false }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, spoolsById, printersById, settings]
  );
  const real = useMemo(
    () => (project ? projectCosts(project, ctx, { real: true }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, spoolsById, printersById, settings]
  );

  if (!project) {
    return (
      <div className="card-pad text-center">
        <p className="muted">Projeto não encontrado.</p>
        <Link to="/projetos" className="btn-secondary mt-3 inline-flex">
          <ArrowLeft size={15} /> Voltar
        </Link>
      </div>
    );
  }

  const client = clientsById[project.clientId];

  const changeStatus = async (status) => {
    const patch = { status };
    // Congela a estimativa automaticamente ao entrar na fila
    if (
      status === 'fila' &&
      !project.budget?.estimateSnapshot &&
      ['orcamento', 'aguardando_aprovacao'].includes(project.status)
    ) {
      patch.budget = clean({
        ...project.budget,
        estimateSnapshot: { at: new Date().toISOString(), ...estimated, perPart: undefined },
      });
      toast('Estimativa congelada para comparação com o custo real.', 'info');
    }
    if (['concluido', 'entregue'].includes(status) && !project.completedAt) {
      patch.completedAt = new Date().toISOString();
    }
    await api.update('projects', project.id, patch, project.name);
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/projetos" className="mb-1 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-blue-500">
            <ArrowLeft size={13} /> Projetos
          </Link>
          <h1 className="page-title flex flex-wrap items-center gap-2">
            {project.name}
            {project.isTest && <span className="badge-gray">teste/calibração</span>}
            {(project.tags || []).map((t, i) => (
              <span key={i} className={TAG_COLORS.find((c) => c.name === t.color)?.class || 'badge-gray'}>
                {t.label}
              </span>
            ))}
          </h1>
          <p className="muted text-sm">
            {project.category} • {client ? `Cliente: ${client.name}` : 'Uso interno'} • Prazo: {dateBR(project.deadline)}
            {' '}• <StatusBadge map={PRIORITIES} value={project.priority} />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-auto" value={project.status} onChange={(e) => changeStatus(e.target.value)}>
            {PROJECT_STATUS_FLOW.map((s) => (
              <option key={s} value={s}>{PROJECT_STATUS[s].label}</option>
            ))}
          </select>
          <button
            className="btn-secondary btn-sm"
            title="Duplicar projeto"
            onClick={async () => {
              const ref = await duplicateProject(api, project);
              toast('Projeto duplicado.');
              navigate(`/projetos/${ref.id}`);
            }}
          >
            <Copy size={14} /> Duplicar
          </button>
          <button
            className="btn-secondary btn-sm"
            title="Salvar como template"
            onClick={async () => {
              await saveAsTemplate(api, project);
              toast('Template salvo.');
            }}
          >
            <LayoutTemplate size={14} /> Template
          </button>
          <button className="btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Resumo de custo/preço sempre visível */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card-pad">
          <p className="label !mb-0.5">Custo estimado</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white">{money(estimated.total)}</p>
        </div>
        <div className="card-pad">
          <p className="label !mb-0.5">Custo real</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white">{money(real.total)}</p>
          {real.failures > 0 && <p className="text-[11px] text-red-500">inclui {money(real.failures)} de falhas</p>}
        </div>
        <div className="card-pad">
          <p className="label !mb-0.5">Preço de venda</p>
          <p className="text-lg font-bold text-green-500">{money(projectPrices(project, ctx).finalPrice)}</p>
        </div>
        <div className="card-pad">
          <p className="label !mb-0.5">Tempo total est.</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white">
            {hoursLabel((project.parts || []).reduce((a, p) => a + (Number(p.estMinutes) || 0), 0))}
          </p>
        </div>
      </div>

      <Tabs
        tabs={[
          { key: 'resumo', label: 'Resumo' },
          { key: 'partes', label: 'Partes & AMS', count: (project.parts || []).length },
          { key: 'orcamento', label: 'Orçamento' },
          { key: 'producao', label: 'Produção', count: (project.failures || []).length || undefined },
          { key: 'pos', label: 'Pós-processo', count: (project.postSteps || []).length || undefined },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'resumo' && <SummaryTab project={project} client={client} />}
      {tab === 'partes' && <PartsTab project={project} />}
      {tab === 'orcamento' && <BudgetTab project={project} estimated={estimated} real={real} />}
      {tab === 'producao' && <ProductionTab project={project} />}
      {tab === 'pos' && <PostTab project={project} />}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Excluir projeto"
        message={`Excluir "${project.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={async () => {
          await api.remove('projects', project.id, project.name);
          navigate('/projetos');
        }}
      />
    </div>
  );
}

// ───────────────────────── Resumo ─────────────────────────

function SummaryTab({ project, client }) {
  const { clients, api } = useData();
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState(null);

  const openEdit = () => {
    setForm({
      name: project.name,
      clientId: project.clientId || '',
      category: project.category || 'Personalizado',
      priority: project.priority || 'normal',
      deadline: project.deadline || '',
      scale: project.scale || '',
      isTest: !!project.isTest,
      description: project.description || '',
      notes: project.notes || '',
      tagsText: (project.tags || []).map((t) => t.label).join(', '),
      tagColor: project.tags?.[0]?.color || 'blue',
      filesText: (project.files || []).map((f) => f.url).join('\n'),
      imagesText: (project.images || []).join('\n'),
    });
    setEdit(true);
  };

  const set = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const save = async () => {
    const tags = form.tagsText.split(',').map((t) => t.trim()).filter(Boolean)
      .map((label) => ({ label, color: form.tagColor }));
    const files = form.filesText.split('\n').map((l) => l.trim()).filter(Boolean)
      .map((url) => ({ label: url.includes('makerworld') ? 'MakerWorld' : url.includes('printables') ? 'Printables' : 'Arquivo', url }));
    const images = form.imagesText.split('\n').map((l) => l.trim()).filter(Boolean);
    await api.update('projects', project.id, {
      name: form.name.trim() || project.name,
      clientId: form.clientId,
      category: form.category,
      priority: form.priority,
      deadline: form.deadline,
      scale: form.scale,
      isTest: form.isTest,
      description: form.description,
      notes: form.notes,
      tags, files, images,
    }, form.name);
    toast('Projeto atualizado.');
    setEdit(false);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="card-pad space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="section-title">Informações</h3>
          <button className="btn-secondary btn-sm" onClick={openEdit}>
            <Pencil size={13} /> Editar
          </button>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="muted">Cliente</dt><dd>{client?.name || 'Uso interno'}</dd>
          <dt className="muted">Categoria</dt><dd>{project.category}</dd>
          <dt className="muted">Escala</dt><dd>{project.scale || '—'}</dd>
          <dt className="muted">Criado em</dt><dd>{dateTimeBR(project.createdAt)}</dd>
          <dt className="muted">Prazo</dt><dd>{dateBR(project.deadline)}</dd>
          {project.completedAt && (<><dt className="muted">Concluído em</dt><dd>{dateTimeBR(project.completedAt)}</dd></>)}
        </dl>
        {project.description && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/50">{project.description}</p>
        )}
        {project.notes && (
          <div>
            <p className="label">Observações</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{project.notes}</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="card-pad">
          <h3 className="section-title mb-2">Arquivos & links</h3>
          {(project.files || []).length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum link cadastrado.</p>
          ) : (
            <ul className="space-y-1.5">
              {project.files.map((f, i) => (
                <li key={i}>
                  <a href={f.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-500 hover:underline">
                    <ExternalLink size={13} /> {f.label}: <span className="truncate">{f.url}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card-pad">
          <h3 className="section-title mb-2">Imagens de referência</h3>
          {(project.images || []).length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma imagem (adicione URLs em Editar).</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {project.images.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt="" className="h-24 w-24 rounded-lg border border-slate-200 object-cover dark:border-slate-700" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal open={edit} onClose={() => setEdit(false)} title="Editar projeto" size="lg"
        footer={<><button className="btn-secondary" onClick={() => setEdit(false)}>Cancelar</button>
          <button className="btn-primary" onClick={save}>Salvar</button></>}>
        {form && (
          <>
            <FormGrid cols={2}>
              <Input label="Nome" name="name" value={form.name} onChange={set} />
              <SearchSelect label="Cliente" value={form.clientId}
                onChange={(v) => setForm((f) => ({ ...f, clientId: v }))}
                options={clients.map((c) => ({ value: c.id, label: c.name }))} placeholder="Uso interno" />
              <Select label="Categoria" name="category" value={form.category} onChange={set} options={PROJECT_CATEGORIES} />
              <Select label="Prioridade" name="priority" value={form.priority} onChange={set}
                options={Object.entries(PRIORITIES).map(([value, v]) => ({ value, label: v.label }))} />
              <Input label="Prazo" type="date" name="deadline" value={form.deadline} onChange={set} />
              <Input label="Escala" name="scale" value={form.scale} onChange={set} />
              <Input label="Etiquetas (vírgula)" name="tagsText" value={form.tagsText} onChange={set} />
              <Select label="Cor das etiquetas" name="tagColor" value={form.tagColor} onChange={set}
                options={TAG_COLORS.map((c) => ({ value: c.name, label: c.name }))} />
            </FormGrid>
            <div className="mt-3.5 space-y-3.5">
              <Checkbox label="Peça de teste/calibração (fora das métricas de venda)" name="isTest" checked={form.isTest} onChange={set} />
              <Textarea label="Descrição" name="description" value={form.description} onChange={set} rows={2} />
              <Textarea label="Links de arquivos (um por linha)" name="filesText" value={form.filesText} onChange={set} rows={2} />
              <Textarea label="URLs de imagens (uma por linha)" name="imagesText" value={form.imagesText} onChange={set} rows={2} />
              <Textarea label="Observações" name="notes" value={form.notes} onChange={set} rows={2} />
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

// ───────────────────────── Partes & AMS ─────────────────────────

const EMPTY_PART = {
  name: '',
  quantity: '1',
  printerId: '',
  estTime: '',
  slots: [],
  fileName: '',
  profileName: '',
  layerHeight: '0.2',
  infill: '15',
  walls: '2',
  nozzleTemp: '',
  bedTemp: '',
  filamentChanges: '',
};

function PartsTab({ project }) {
  const { spools, spoolsById, printers, api, profiles } = useData();
  const toast = useToast();
  const [modal, setModal] = useState(null); // {partId?}
  const [form, setForm] = useState(EMPTY_PART);
  const [confirm, setConfirm] = useState(null);

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const openNew = () => {
    setForm({ ...EMPTY_PART, printerId: printers[0]?.id || '' });
    setModal({});
  };

  const openEdit = (part) => {
    setForm({
      name: part.name,
      quantity: String(part.quantity ?? 1),
      printerId: part.printerId || '',
      estTime: durationInput(part.estMinutes),
      slots: (part.slots || []).map((s) => ({ ...s, gramsPiece: String(s.gramsPiece ?? ''), gramsPurge: String(s.gramsPurge ?? '') })),
      fileName: part.sliceData?.fileName || '',
      profileName: part.sliceData?.profileName || '',
      layerHeight: part.sliceData?.layerHeight ?? '',
      infill: part.sliceData?.infill ?? '',
      walls: part.sliceData?.walls ?? '',
      nozzleTemp: part.sliceData?.nozzleTemp ?? '',
      bedTemp: part.sliceData?.bedTemp ?? '',
      filamentChanges: part.sliceData?.filamentChanges ?? '',
    });
    setModal({ partId: part.id });
  };

  const applyProfile = (profileId) => {
    const p = profiles.find((x) => x.id === profileId);
    if (!p) return;
    setForm((f) => ({
      ...f,
      profileName: p.name,
      layerHeight: p.layerHeight ?? f.layerHeight,
      infill: p.infill ?? f.infill,
      walls: p.walls ?? f.walls,
      nozzleTemp: p.nozzleTemp ?? f.nozzleTemp,
      bedTemp: p.bedTemp ?? f.bedTemp,
    }));
  };

  const save = async () => {
    if (!form.name.trim()) return toast('Informe o nome da parte.', 'warning');
    const slots = form.slots
      .filter((s) => s.spoolId)
      .map((s) => ({
        slot: s.slot,
        spoolId: s.spoolId,
        gramsPiece: toNum(s.gramsPiece),
        gramsPurge: toNum(s.gramsPurge),
      }));
    const partData = {
      name: form.name.trim(),
      quantity: toNum(form.quantity) || 1,
      printerId: form.printerId,
      estMinutes: parseDuration(form.estTime),
      slots,
      sliceData: {
        fileName: form.fileName,
        profileName: form.profileName,
        layerHeight: form.layerHeight,
        infill: form.infill,
        walls: form.walls,
        nozzleTemp: form.nozzleTemp,
        bedTemp: form.bedTemp,
        filamentChanges: toNum(form.filamentChanges),
      },
    };

    let parts;
    if (modal.partId) {
      parts = project.parts.map((p) => (p.id === modal.partId ? { ...p, ...partData } : p));
    } else {
      parts = [
        ...(project.parts || []),
        {
          id: genId(),
          ...partData,
          prodStatus: 'pendente',
          attempts: 0,
          startedAt: null,
          finishedAt: null,
          realMinutes: 0,
          consumed: false,
        },
      ];
    }
    await api.update('projects', project.id, { parts: clean(parts) }, `${project.name} — partes`);
    toast(modal.partId ? 'Parte atualizada.' : 'Parte adicionada.');
    setModal(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="muted text-sm">
          Cada parte = uma impressão (plate) no Bambu Studio. Os valores de gramas e tempo vêm do fatiamento.
        </p>
        <button className="btn-primary btn-sm" onClick={openNew}>
          <Plus size={14} /> Nova parte
        </button>
      </div>

      {(project.parts || []).length === 0 ? (
        <div className="card-pad text-center text-sm text-slate-400">
          Nenhuma parte cadastrada. Adicione as impressões deste projeto (um kit pode ter várias).
        </div>
      ) : (
        (project.parts || []).map((part) => {
          const fil = partFilament(part, spoolsById);
          return (
            <div key={part.id} className="card-pad space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <h4 className="font-bold text-slate-900 dark:text-white">{part.name}</h4>
                  <span className="badge-gray">{part.quantity}× peça(s)</span>
                  <StatusBadge map={PART_STATUS} value={part.prodStatus} />
                </div>
                <div className="flex gap-1">
                  <button className="btn-icon" onClick={() => openEdit(part)}><Pencil size={15} /></button>
                  <button className="btn-icon hover:!text-red-500" onClick={() => setConfirm(part)}><Trash2 size={15} /></button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div><p className="label !mb-0">Tempo est.</p><p className="font-semibold">{hoursLabel(part.estMinutes)}</p></div>
                <div><p className="label !mb-0">Filamento</p><p className="font-semibold">{grams(fil.gramsPiece)} <span className="muted text-xs">+ {grams(fil.gramsPurge)} purga</span></p></div>
                <div><p className="label !mb-0">Custo filamento</p><p className="font-semibold">{money(fil.costTotal)}</p></div>
                <div><p className="label !mb-0">Trocas de cor</p><p className="font-semibold">{part.sliceData?.filamentChanges || 0}</p></div>
              </div>

              {(part.slots || []).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {part.slots.map((s) => {
                    const spool = spoolsById[s.spoolId];
                    return (
                      <span key={s.slot} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700">
                        <b className="text-blue-500">S{s.slot}</b>
                        <ColorDot hex={spool?.colorHex} size={11} />
                        {spool ? `${spool.material} ${spool.colorName}` : 'bobina removida'}
                        <span className="muted">{grams(s.gramsPiece)}+{grams(s.gramsPurge)}</span>
                      </span>
                    );
                  })}
                </div>
              )}

              {part.sliceData?.fileName && (
                <p className="text-xs text-slate-400">
                  📄 {part.sliceData.fileName}
                  {part.sliceData.profileName && ` • perfil: ${part.sliceData.profileName}`}
                  {part.sliceData.layerHeight && ` • ${part.sliceData.layerHeight}mm`}
                  {part.sliceData.infill && ` • infill ${part.sliceData.infill}%`}
                  {part.sliceData.walls && ` • ${part.sliceData.walls} paredes`}
                  {part.sliceData.nozzleTemp && ` • bico ${part.sliceData.nozzleTemp}°C`}
                  {part.sliceData.bedTemp && ` • mesa ${part.sliceData.bedTemp}°C`}
                </p>
              )}
            </div>
          );
        })
      )}

      {/* Modal de parte */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.partId ? 'Editar parte' : 'Nova parte (impressão)'}
        size="xl"
        footer={<><button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
          <button className="btn-primary" onClick={save}>Salvar parte</button></>}
      >
        <div className="space-y-4">
          <FormGrid cols={3}>
            <Input label="Nome da parte *" name="name" value={form.name} onChange={set} placeholder="Ex: Corpo, Base, Cabeça" />
            <Input label="Qtd de peças nesta impressão" name="quantity" inputMode="numeric" value={form.quantity} onChange={set} />
            <Select label="Impressora" name="printerId" value={form.printerId} onChange={set} placeholder="Selecionar..."
              options={printers.map((p) => ({ value: p.id, label: p.name }))} />
          </FormGrid>

          <div>
            <p className="label">Slots do AMS — bobina, gramas da peça e purga (copie do Bambu Studio)</p>
            <SlotEditor
              slots={form.slots}
              onChange={(slots) => setForm((f) => ({ ...f, slots }))}
              spools={spools}
              spoolsById={spoolsById}
            />
          </div>

          <FormGrid cols={3}>
            <Input label="Tempo estimado (hh:mm)" name="estTime" value={form.estTime} onChange={set} placeholder="Ex: 7:45" />
            <Input label="Nº de trocas de filamento" name="filamentChanges" inputMode="numeric" value={form.filamentChanges} onChange={set} />
            <Select label="Aplicar perfil salvo" value="" onChange={(e) => applyProfile(e.target.value)} placeholder="Biblioteca de perfis..."
              options={profiles.map((p) => ({ value: p.id, label: p.name }))} />
          </FormGrid>

          <p className="section-title">Dados do fatiamento (Bambu Studio)</p>
          <FormGrid cols={4}>
            <Input label="Arquivo 3MF/G-code" name="fileName" value={form.fileName} onChange={set} placeholder="modelo.gcode.3mf" />
            <Input label="Perfil usado" name="profileName" value={form.profileName} onChange={set} placeholder="0.20mm Standard" />
            <Input label="Altura de camada (mm)" name="layerHeight" value={form.layerHeight} onChange={set} />
            <Input label="Infill (%)" name="infill" value={form.infill} onChange={set} />
            <Input label="Paredes" name="walls" value={form.walls} onChange={set} />
            <Input label="Temp. bico (°C)" name="nozzleTemp" value={form.nozzleTemp} onChange={set} />
            <Input label="Temp. mesa (°C)" name="bedTemp" value={form.bedTemp} onChange={set} />
          </FormGrid>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Excluir parte"
        message={`Excluir a parte "${confirm?.name}"?`}
        onConfirm={async () => {
          const parts = project.parts.filter((p) => p.id !== confirm.id);
          await api.update('projects', project.id, { parts: clean(parts) }, `${project.name} — partes`);
          toast('Parte excluída.');
        }}
      />
    </div>
  );
}

// ───────────────────────── Orçamento ─────────────────────────

function BudgetTab({ project, estimated, real }) {
  const { spoolsById, printersById, settings, api } = useData();
  const toast = useToast();
  const ctx = { spoolsById, printersById, settings };
  const budget = project.budget || {};
  const prices = projectPrices(project, ctx);

  const [form, setForm] = useState({
    laborMode: budget.laborMode || 'hourly',
    laborHours: String(budget.laborHours ?? ''),
    laborFixed: String(budget.laborFixed ?? ''),
    packagingCost: String(budget.packagingCost ?? ''),
    shippingCost: String(budget.shippingCost ?? ''),
    failureRate: String(budget.failureRate ?? settings.failureRatePct ?? 10),
    marginSale: String(budget.margins?.sale ?? settings.margins.sale),
    marginResale: String(budget.margins?.resale ?? settings.margins.resale),
    marginWholesale: String(budget.margins?.wholesale ?? settings.margins.wholesale),
    promoDiscount: String(budget.promoDiscount ?? ''),
    manualPrice: budget.manualPrice ?? '',
    finishing: (budget.finishing || []).map((f) => ({ desc: f.desc, value: String(f.value) })),
  });
  const [priceModal, setPriceModal] = useState(false);
  const [priceForm, setPriceForm] = useState({ price: '', reason: '' });

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const saveBudget = async () => {
    const newBudget = {
      ...budget,
      laborMode: form.laborMode,
      laborHours: toNum(form.laborHours),
      laborFixed: toNum(form.laborFixed),
      packagingCost: toNum(form.packagingCost),
      shippingCost: toNum(form.shippingCost),
      failureRate: toNum(form.failureRate),
      margins: {
        sale: toNum(form.marginSale),
        resale: toNum(form.marginResale),
        wholesale: toNum(form.marginWholesale),
      },
      promoDiscount: toNum(form.promoDiscount),
      manualPrice: form.manualPrice === '' ? null : toNum(form.manualPrice),
      finishing: form.finishing.filter((f) => f.desc.trim()).map((f) => ({ desc: f.desc.trim(), value: toNum(f.value) })),
    };
    await api.update('projects', project.id, { budget: clean(newBudget) }, `${project.name} — orçamento`);
    toast('Orçamento salvo.');
  };

  const freezeEstimate = async () => {
    const snapshot = { at: new Date().toISOString(), ...estimated };
    delete snapshot.perPart;
    await api.update('projects', project.id,
      { budget: clean({ ...budget, estimateSnapshot: snapshot }) }, `${project.name} — estimativa congelada`);
    toast('Estimativa congelada. Será comparada ao custo real após a produção.');
  };

  const registerPrice = async () => {
    const price = toNum(priceForm.price);
    if (price <= 0) return toast('Informe o novo preço.', 'warning');
    const entry = { date: new Date().toISOString(), price, reason: priceForm.reason || 'Ajuste manual' };
    await api.update('projects', project.id, {
      budget: clean({ ...budget, manualPrice: price, priceHistory: [...(budget.priceHistory || []), entry] }),
    }, `${project.name} — preço alterado`);
    toast('Preço registrado no histórico.');
    setPriceModal(false);
    setPriceForm({ price: '', reason: '' });
    setForm((f) => ({ ...f, manualPrice: String(price) }));
  };

  const snapshot = budget.estimateSnapshot;

  const lines = [
    ['Filamento (peças)', estimated.filamentPiece, real.filamentPiece],
    ['Purga / desperdício AMS', estimated.filamentPurge, real.filamentPurge],
    ['Energia elétrica', estimated.energy, real.energy],
    ['Hora-máquina (depreciação)', estimated.machine, real.machine],
    ['Mão de obra', estimated.labor, real.labor],
    ['Acabamento', estimated.finishing, real.finishing],
    ['Embalagem', estimated.packaging, real.packaging],
    ['Frete', estimated.shipping, real.shipping],
    ['Pós-processamento', estimated.post, real.post],
    [`Reserva p/ falhas (${pct(estimated.failureRate)})`, estimated.failureReserve, real.failures],
  ];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {/* Composição do custo */}
      <div className="card-pad">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="section-title">Composição do custo</h3>
          <button className="btn-secondary btn-sm" onClick={freezeEstimate} title="Congelar estimativa atual para comparar com o real">
            <Snowflake size={13} /> Congelar estimativa
          </button>
        </div>
        <table className="table-base">
          <thead><tr><th>Item</th><th className="text-right">Estimado</th><th className="text-right">Real</th></tr></thead>
          <tbody>
            {lines.map(([label, est, re]) => (
              <tr key={label}>
                <td>{label}</td>
                <td className="text-right">{money(est)}</td>
                <td className={`text-right ${re > est ? 'text-red-500' : ''}`}>{money(re)}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td>Total</td>
              <td className="text-right text-blue-500">{money(estimated.total)}</td>
              <td className={`text-right ${real.total > estimated.total ? 'text-red-500' : 'text-green-500'}`}>{money(real.total)}</td>
            </tr>
          </tbody>
        </table>

        {snapshot && (
          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-sm dark:bg-slate-800/50">
            <p className="font-semibold">📌 Estimativa congelada em {dateTimeBR(snapshot.at)}: {money(snapshot.total)}</p>
            <p className={`text-xs ${real.total > snapshot.total ? 'text-red-500' : 'text-green-500'}`}>
              Custo real atual: {money(real.total)} ({real.total > snapshot.total ? '+' : ''}
              {money(real.total - snapshot.total)} vs congelado)
            </p>
          </div>
        )}

        <h3 className="section-title mb-2 mt-5">Custo por parte</h3>
        <table className="table-base">
          <thead><tr><th>Parte</th><th className="text-right">Filamento</th><th className="text-right">Energia</th><th className="text-right">Máquina</th><th className="text-right">Total</th></tr></thead>
          <tbody>
            {estimated.perPart.map((p) => (
              <tr key={p.partId}>
                <td>{p.name}</td>
                <td className="text-right">{money(p.costTotal)}</td>
                <td className="text-right">{money(p.energy)}</td>
                <td className="text-right">{money(p.machine)}</td>
                <td className="text-right font-semibold">{money(p.total)}</td>
              </tr>
            ))}
            {estimated.perPart.length === 0 && (
              <tr><td colSpan={5} className="text-center text-slate-400">Adicione partes na aba "Partes & AMS"</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Outros custos + precificação */}
      <div className="space-y-4">
        <div className="card-pad space-y-3.5">
          <h3 className="section-title">Outros custos</h3>
          <FormGrid cols={3}>
            <Select label="Mão de obra" name="laborMode" value={form.laborMode} onChange={set}
              options={[{ value: 'hourly', label: `Por hora (${money(settings.laborRate)}/h)` }, { value: 'fixed', label: 'Valor fixo' }]} />
            {form.laborMode === 'hourly' ? (
              <Input label="Horas de trabalho" name="laborHours" inputMode="decimal" value={form.laborHours} onChange={set} />
            ) : (
              <Input label="Valor fixo (R$)" name="laborFixed" inputMode="decimal" value={form.laborFixed} onChange={set} />
            )}
            <Input label="Embalagem (R$)" name="packagingCost" inputMode="decimal" value={form.packagingCost} onChange={set} />
            <Input label="Frete (R$, opcional)" name="shippingCost" inputMode="decimal" value={form.shippingCost} onChange={set} />
            <Input label="Reserva p/ falhas (%)" name="failureRate" inputMode="decimal" value={form.failureRate} onChange={set}
              hint="Sobre filamento + energia + máquina" />
          </FormGrid>

          <div>
            <p className="label">Acabamento (descrição + valor)</p>
            <div className="space-y-2">
              {form.finishing.map((f, i) => (
                <div key={i} className="flex gap-2">
                  <input className="input flex-1" placeholder="Ex: tinta + primer" value={f.desc}
                    onChange={(e) => setForm((fm) => ({ ...fm, finishing: fm.finishing.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)) }))} />
                  <input className="input w-28" placeholder="R$" inputMode="decimal" value={f.value}
                    onChange={(e) => setForm((fm) => ({ ...fm, finishing: fm.finishing.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) }))} />
                  <button className="btn-icon shrink-0" onClick={() => setForm((fm) => ({ ...fm, finishing: fm.finishing.filter((_, j) => j !== i) }))}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button className="btn-secondary btn-sm" onClick={() => setForm((fm) => ({ ...fm, finishing: [...fm.finishing, { desc: '', value: '' }] }))}>
                <Plus size={13} /> Adicionar item
              </button>
            </div>
          </div>
        </div>

        <div className="card-pad space-y-3.5">
          <h3 className="section-title">Precificação</h3>
          <FormGrid cols={3}>
            <Input label="Margem venda (%)" name="marginSale" inputMode="decimal" value={form.marginSale} onChange={set} />
            <Input label="Margem revenda (%)" name="marginResale" inputMode="decimal" value={form.marginResale} onChange={set} />
            <Input label="Margem atacado (%)" name="marginWholesale" inputMode="decimal" value={form.marginWholesale} onChange={set} />
          </FormGrid>

          <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/50">
            <div>
              <p className="label !mb-0.5">Venda</p>
              <p className="text-lg font-bold text-green-500">{money(prices.sale)}</p>
              <p className="text-[10px] text-slate-400">margem {pct(prices.margins.sale)}</p>
            </div>
            <div>
              <p className="label !mb-0.5">Revenda</p>
              <p className="text-lg font-bold text-cyan-500">{money(prices.resale)}</p>
              <p className="text-[10px] text-slate-400">margem {pct(prices.margins.resale)}</p>
            </div>
            <div>
              <p className="label !mb-0.5">Atacado</p>
              <p className="text-lg font-bold text-purple-500">{money(prices.wholesale)}</p>
              <p className="text-[10px] text-slate-400">margem {pct(prices.margins.wholesale)}</p>
            </div>
          </div>

          <FormGrid cols={2}>
            <Input label="Preço manual (sobrescreve o sugerido)" name="manualPrice" inputMode="decimal"
              value={form.manualPrice} onChange={set} placeholder={money(prices.sale)} />
            <Input label="Desconto promocional (%)" name="promoDiscount" inputMode="decimal" value={form.promoDiscount} onChange={set} />
          </FormGrid>

          <div className="flex items-center justify-between rounded-xl border-2 border-green-500/40 bg-green-500/5 px-4 py-3">
            <div>
              <p className="label !mb-0">Preço final</p>
              <p className="text-xl font-extrabold text-green-500">{money(prices.finalPrice)}</p>
            </div>
            {prices.promo !== null && (
              <div className="text-right">
                <p className="label !mb-0">Promocional (−{pct(toNum(form.promoDiscount))})</p>
                <p className="text-lg font-bold text-amber-500">{money(prices.promo)}</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button className="btn-secondary btn-sm" onClick={() => setPriceModal(true)}>
              Registrar alteração de preço
            </button>
            <button className="btn-primary" onClick={saveBudget}>Salvar orçamento</button>
          </div>
        </div>

        {(budget.priceHistory || []).length > 0 && (
          <div className="card-pad">
            <h3 className="section-title mb-2">Histórico de preços</h3>
            <table className="table-base">
              <thead><tr><th>Data</th><th>Preço</th><th>Motivo</th></tr></thead>
              <tbody>
                {[...budget.priceHistory].reverse().map((h, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap">{dateTimeBR(h.date)}</td>
                    <td className="font-semibold">{money(h.price)}</td>
                    <td>{h.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={priceModal} onClose={() => setPriceModal(false)} title="Registrar alteração de preço" size="sm"
        footer={<><button className="btn-secondary" onClick={() => setPriceModal(false)}>Cancelar</button>
          <button className="btn-primary" onClick={registerPrice}>Registrar</button></>}>
        <div className="space-y-3.5">
          <Input label="Novo preço (R$)" inputMode="decimal" value={priceForm.price}
            onChange={(e) => setPriceForm((f) => ({ ...f, price: e.target.value }))} />
          <Input label="Motivo" value={priceForm.reason}
            onChange={(e) => setPriceForm((f) => ({ ...f, reason: e.target.value }))}
            placeholder="Ex: aumento do filamento, promoção..." />
        </div>
      </Modal>
    </div>
  );
}

// ───────────────────────── Produção (histórico) ─────────────────────────

function ProductionTab({ project }) {
  const { printersById } = useData();
  return (
    <div className="space-y-4">
      <div className="card-pad">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="section-title">Status das impressões</h3>
          <Link to="/producao" className="btn-primary btn-sm">Ir para a fila de produção →</Link>
        </div>
        <table className="table-base">
          <thead>
            <tr><th>Parte</th><th>Status</th><th>Impressora</th><th>Tentativas</th><th>Início</th><th>Fim</th><th>Est. vs Real</th></tr>
          </thead>
          <tbody>
            {(project.parts || []).map((p) => (
              <tr key={p.id}>
                <td className="font-semibold">{p.name}</td>
                <td><StatusBadge map={PART_STATUS} value={p.prodStatus} /></td>
                <td>{printersById[p.printerId]?.name || '—'}</td>
                <td>{p.attempts || 0}</td>
                <td className="whitespace-nowrap">{p.startedAt ? dateTimeBR(p.startedAt) : '—'}</td>
                <td className="whitespace-nowrap">{p.finishedAt ? dateTimeBR(p.finishedAt) : '—'}</td>
                <td className="whitespace-nowrap">
                  {hoursLabel(p.estMinutes)} / {p.realMinutes ? (
                    <b className={p.realMinutes > p.estMinutes ? 'text-red-500' : 'text-green-500'}>{hoursLabel(p.realMinutes)}</b>
                  ) : '—'}
                </td>
              </tr>
            ))}
            {(project.parts || []).length === 0 && (
              <tr><td colSpan={7} className="text-center text-slate-400">Sem partes cadastradas.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card-pad">
        <h3 className="section-title mb-2">Falhas registradas</h3>
        {(project.failures || []).length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma falha 🎉</p>
        ) : (
          <table className="table-base">
            <thead><tr><th>Data</th><th>Parte</th><th>Motivo</th><th>Tempo perdido</th><th>Custo</th><th>Reimpressão</th></tr></thead>
            <tbody>
              {[...project.failures].reverse().map((f) => (
                <tr key={f.id}>
                  <td className="whitespace-nowrap">{dateTimeBR(f.date)}</td>
                  <td>{f.partName}</td>
                  <td>
                    {f.reason}
                    {f.reasonNote && <span className="muted text-xs"> — {f.reasonNote}</span>}
                  </td>
                  <td>{hoursLabel(f.lostMinutes)}</td>
                  <td className="font-semibold text-red-500">{money(f.cost)}</td>
                  <td>{f.reprint ? <span className="badge-blue">sim</span> : <span className="badge-gray">não</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── Pós-processo ─────────────────────────

function PostTab({ project }) {
  const { settings, api } = useData();
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: POST_STEPS[0], minutes: '', cost: '', notes: '' });
  const [photosText, setPhotosText] = useState((project.photos || []).join('\n'));

  const steps = project.postSteps || [];
  const totalMin = steps.reduce((a, s) => a + (Number(s.minutes) || 0), 0);
  const totalCost = steps.reduce((a, s) => a + (Number(s.cost) || 0), 0) + (totalMin / 60) * (settings.laborRate || 0);

  const saveStep = async () => {
    let postSteps;
    const data = {
      name: form.name, minutes: toNum(form.minutes), cost: toNum(form.cost), notes: form.notes,
    };
    if (modal.stepId) {
      postSteps = steps.map((s) => (s.id === modal.stepId ? { ...s, ...data } : s));
    } else {
      postSteps = [...steps, { id: genId(), ...data, done: false }];
    }
    await api.update('projects', project.id, { postSteps: clean(postSteps) }, `${project.name} — pós-processo`);
    toast('Etapa salva.');
    setModal(null);
  };

  const toggleDone = async (step) => {
    const postSteps = steps.map((s) => (s.id === step.id ? { ...s, done: !s.done } : s));
    await api.update('projects', project.id, { postSteps: clean(postSteps) }, `${project.name} — pós-processo`);
  };

  const removeStep = async (step) => {
    await api.update('projects', project.id,
      { postSteps: clean(steps.filter((s) => s.id !== step.id)) }, `${project.name} — pós-processo`);
  };

  const setQuality = async (quality) => {
    await api.update('projects', project.id, { quality }, `${project.name} — qualidade`);
    toast('Avaliação registrada.');
  };

  const savePhotos = async () => {
    const photos = photosText.split('\n').map((l) => l.trim()).filter(Boolean);
    await api.update('projects', project.id, { photos }, `${project.name} — fotos`);
    toast('Fotos salvas.');
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="card-pad space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="section-title">Etapas de pós-processamento</h3>
          <button className="btn-primary btn-sm" onClick={() => { setForm({ name: POST_STEPS[0], minutes: '', cost: '', notes: '' }); setModal({}); }}>
            <Plus size={14} /> Etapa
          </button>
        </div>

        {steps.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma etapa. Adicione lixamento, pintura, montagem...</p>
        ) : (
          <ul className="space-y-2">
            {steps.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                <input type="checkbox" checked={!!s.done} onChange={() => toggleDone(s)}
                  className="h-4 w-4 rounded border-slate-300 text-green-600" />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${s.done ? 'text-slate-400 line-through' : ''}`}>{s.name}</p>
                  <p className="text-xs text-slate-400">
                    {hoursLabel(s.minutes)} • custo direto {money(s.cost)}
                    {s.notes && ` • ${s.notes}`}
                  </p>
                </div>
                <button className="btn-icon" onClick={() => { setForm({ name: s.name, minutes: String(s.minutes || ''), cost: String(s.cost || ''), notes: s.notes || '' }); setModal({ stepId: s.id }); }}>
                  <Pencil size={14} />
                </button>
                <button className="btn-icon hover:!text-red-500" onClick={() => removeStep(s)}>
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm dark:bg-slate-800/50">
          Total: <b>{hoursLabel(totalMin)}</b> de trabalho • <b>{money(totalCost)}</b>{' '}
          <span className="muted text-xs">(custo direto + {money(settings.laborRate)}/h de mão de obra) — já somado no orçamento</span>
        </div>

        <div>
          <p className="label">Avaliação de qualidade final</p>
          <div className="flex gap-2">
            {Object.entries(QUALITY).map(([key, q]) => (
              <button key={key}
                className={project.quality === key ? q.badge + ' !px-3 !py-1.5 !text-sm' : 'btn-secondary btn-sm'}
                onClick={() => setQuality(key)}>
                {q.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card-pad space-y-3">
        <h3 className="section-title flex items-center gap-2"><Camera size={15} /> Fotos da peça finalizada</h3>
        <Textarea label="URLs das fotos (uma por linha)" value={photosText} onChange={(e) => setPhotosText(e.target.value)} rows={3}
          hint="Cole links de imagens (Google Drive, Imgur, etc.)" />
        <button className="btn-secondary btn-sm" onClick={savePhotos}>Salvar fotos</button>
        {(project.photos || []).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {project.photos.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer">
                <img src={url} alt="" className="h-28 w-28 rounded-lg border border-slate-200 object-cover dark:border-slate-700" />
              </a>
            ))}
          </div>
        )}
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.stepId ? 'Editar etapa' : 'Nova etapa'} size="sm"
        footer={<><button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
          <button className="btn-primary" onClick={saveStep}>Salvar</button></>}>
        <div className="space-y-3.5">
          <Select label="Etapa" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            options={[...POST_STEPS, ...(POST_STEPS.includes(form.name) ? [] : [form.name])]} />
          <Input label="Ou digite uma etapa personalizada" value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <FormGrid cols={2}>
            <Input label="Tempo (minutos)" inputMode="numeric" value={form.minutes}
              onChange={(e) => setForm((f) => ({ ...f, minutes: e.target.value }))} />
            <Input label="Custo direto (R$)" inputMode="decimal" value={form.cost}
              onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
              hint="Materiais: tinta, cola, verniz..." />
          </FormGrid>
          <Textarea label="Observações" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
        </div>
      </Modal>
    </div>
  );
}
