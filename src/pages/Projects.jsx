import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, FilePlus2, LayoutTemplate, Plus, Trash2 } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import DataTable from '../components/ui/DataTable';
import StatusBadge from '../components/ui/Badge';
import { Checkbox, FormGrid, Input, Select, Textarea } from '../components/ui/Field';
import SearchSelect from '../components/ui/SearchSelect';
import { PRIORITIES, PROJECT_CATEGORIES, PROJECT_STATUS, TAG_COLORS } from '../lib/constants';
import { projectCosts } from '../lib/calculations';
import { duplicateProject, projectFromTemplate } from '../lib/ops';
import { dateBR, money, todayInput } from '../lib/format';

const EMPTY = {
  name: '',
  clientId: '',
  category: 'Personalizado',
  priority: 'normal',
  status: 'orcamento',
  deadline: '',
  description: '',
  scale: '100%',
  isTest: false,
  tagsText: '',
  tagColor: 'blue',
  filesText: '',
  notes: '',
};

export default function Projects() {
  const { projects, clients, clientsById, spoolsById, printersById, settings, templates, api } = useData();
  const toast = useToast();
  const navigate = useNavigate();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [confirm, setConfirm] = useState(null);
  const [templateModal, setTemplateModal] = useState(false);

  const ctx = { spoolsById, printersById, settings };

  const rows = useMemo(
    () => projects.map((p) => ({ ...p, _cost: projectCosts(p, ctx).total })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, spoolsById, printersById, settings]
  );

  const set = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const save = async () => {
    if (!form.name.trim()) return toast('Informe o nome do projeto.', 'warning');
    const isTestCategory = ['Teste', 'Calibração'].includes(form.category);
    const tags = form.tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((label) => ({ label, color: form.tagColor }));
    const files = form.filesText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((url) => ({ label: url.includes('makerworld') ? 'MakerWorld' : url.includes('printables') ? 'Printables' : 'Arquivo', url }));

    const data = {
      name: form.name.trim(),
      clientId: form.clientId,
      category: form.category,
      priority: form.priority,
      status: form.status,
      deadline: form.deadline,
      description: form.description,
      scale: form.scale,
      isTest: form.isTest || isTestCategory,
      tags,
      files,
      images: [],
      notes: form.notes,
      parts: [],
      failures: [],
      postSteps: [],
      quality: '',
      photos: [],
      budget: {
        laborMode: 'hourly',
        laborHours: 0,
        laborFixed: 0,
        finishing: [],
        packagingCost: 0,
        shippingCost: 0,
        failureRate: settings.failureRatePct ?? 10,
        margins: { ...settings.margins },
        promoDiscount: 0,
        manualPrice: null,
        priceHistory: [],
        estimateSnapshot: null,
        channel: { name: 'Direto', commissionPct: 0, fixedFee: 0 },
      },
    };
    try {
      const ref = await api.add('projects', data);
      toast('Projeto criado! Agora configure as partes e o orçamento.');
      setModal(false);
      navigate(`/projetos/${ref.id}`);
    } catch (err) {
      toast(`Erro: ${err.message}`, 'error');
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Projeto',
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
            {r.name}
            {r.isTest && <span className="badge-gray">teste</span>}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            <span className="text-xs text-slate-400">{r.category}</span>
            {(r.tags || []).map((t, i) => (
              <span key={i} className={TAG_COLORS.find((c) => c.name === t.color)?.class || 'badge-gray'}>
                {t.label}
              </span>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: 'client',
      label: 'Cliente',
      sortValue: (r) => clientsById[r.clientId]?.name || '',
      render: (r) => clientsById[r.clientId]?.name || <span className="muted">uso interno</span>,
    },
    {
      key: 'priority',
      label: 'Prioridade',
      sortValue: (r) => PRIORITIES[r.priority]?.order ?? 9,
      render: (r) => <StatusBadge map={PRIORITIES} value={r.priority} />,
    },
    {
      key: 'status',
      label: 'Status',
      sortValue: (r) => r.status,
      render: (r) => <StatusBadge map={PROJECT_STATUS} value={r.status} />,
    },
    {
      key: 'deadline',
      label: 'Prazo',
      sortValue: (r) => r.deadline || 'zzzz',
      render: (r) => {
        if (!r.deadline) return <span className="muted">—</span>;
        const overdue = r.deadline < todayInput() && !['concluido', 'entregue', 'cancelado'].includes(r.status);
        return <span className={overdue ? 'font-bold text-red-500' : ''}>{dateBR(r.deadline)}</span>;
      },
    },
    { key: 'parts', label: 'Partes', sortValue: (r) => (r.parts || []).length, render: (r) => (r.parts || []).length },
    {
      key: '_cost',
      label: 'Custo est.',
      sortValue: (r) => r._cost,
      render: (r) => <span className="font-medium">{money(r._cost)}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Projetos</h1>
          <p className="muted text-sm">Do orçamento à entrega — kits, partes e custos consolidados</p>
        </div>
        <div className="flex gap-2">
          {templates.length > 0 && (
            <button className="btn-secondary" onClick={() => setTemplateModal(true)}>
              <LayoutTemplate size={16} /> Usar template
            </button>
          )}
          <button className="btn-primary" onClick={() => { setForm(EMPTY); setModal(true); }}>
            <Plus size={16} /> Novo projeto
          </button>
        </div>
      </div>

      <DataTable
        data={rows}
        searchKeys={['name', 'description', (r) => (r.tags || []).map((t) => t.label).join(' ')]}
        searchPlaceholder="Buscar projetos, tags..."
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: Object.entries(PROJECT_STATUS).map(([value, v]) => ({ value, label: v.label })),
          },
          {
            key: 'category',
            label: 'Categoria',
            options: PROJECT_CATEGORIES.map((c) => ({ value: c, label: c })),
          },
          {
            key: 'priority',
            label: 'Prioridade',
            options: Object.entries(PRIORITIES).map(([value, v]) => ({ value, label: v.label })),
          },
          {
            key: 'isTest',
            label: 'Tipo',
            options: [
              { value: 'venda', label: 'Para venda' },
              { value: 'teste', label: 'Teste/calibração' },
            ],
            fn: (r, v) => (v === 'teste' ? r.isTest : !r.isTest),
          },
        ]}
        columns={columns}
        initialSort={{ key: 'priority', dir: 'asc' }}
        onRowClick={(r) => navigate(`/projetos/${r.id}`)}
        emptyTitle="Nenhum projeto ainda"
        emptyMessage="Crie seu primeiro projeto para começar a orçar e produzir."
        rowActions={(r) => (
          <>
            <button
              className="btn-icon"
              title="Duplicar projeto"
              onClick={async () => {
                const ref = await duplicateProject(api, r);
                toast('Projeto duplicado.');
                navigate(`/projetos/${ref.id}`);
              }}
            >
              <Copy size={15} />
            </button>
            <button className="btn-icon hover:!text-red-500" title="Excluir" onClick={() => setConfirm(r)}>
              <Trash2 size={15} />
            </button>
          </>
        )}
      />

      {/* ───── Novo projeto ───── */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Novo projeto"
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn-primary" onClick={save}>Criar projeto</button>
          </>
        }
      >
        <FormGrid cols={2}>
          <Input label="Nome do projeto *" name="name" value={form.name} onChange={set} placeholder="Ex: Goku SSJ 30cm" />
          <SearchSelect
            label="Cliente (vazio = uso interno)"
            value={form.clientId}
            onChange={(v) => setForm((f) => ({ ...f, clientId: v }))}
            options={clients.map((c) => ({ value: c.id, label: c.name, sublabel: c.phone }))}
            placeholder="Uso interno"
          />
          <Select label="Categoria" name="category" value={form.category} onChange={set} options={PROJECT_CATEGORIES} />
          <Select label="Prioridade" name="priority" value={form.priority} onChange={set}
            options={Object.entries(PRIORITIES).map(([value, v]) => ({ value, label: v.label }))} />
          <Select label="Status inicial" name="status" value={form.status} onChange={set}
            options={Object.entries(PROJECT_STATUS).map(([value, v]) => ({ value, label: v.label }))} />
          <Input label="Prazo" type="date" name="deadline" value={form.deadline} onChange={set} />
          <Input label="Escala" name="scale" value={form.scale} onChange={set} placeholder="Ex: 100%, 150%" />
          <div className="flex items-end pb-1">
            <Checkbox label="Peça de teste/calibração (fora das métricas de venda)" name="isTest" checked={form.isTest} onChange={set} />
          </div>
        </FormGrid>
        <div className="mt-3.5 space-y-3.5">
          <Textarea label="Descrição" name="description" value={form.description} onChange={set} rows={2} />
          <FormGrid cols={2}>
            <Input label="Etiquetas (separadas por vírgula)" name="tagsText" value={form.tagsText} onChange={set} placeholder="dragonball, pintado" />
            <Select label="Cor das etiquetas" name="tagColor" value={form.tagColor} onChange={set}
              options={TAG_COLORS.map((c) => ({ value: c.name, label: c.name }))} />
          </FormGrid>
          <Textarea label="Links de arquivos (um por linha — STL/3MF/MakerWorld/Printables)" name="filesText"
            value={form.filesText} onChange={set} rows={2} placeholder="https://makerworld.com/..." />
          <Textarea label="Observações" name="notes" value={form.notes} onChange={set} rows={2} />
        </div>
      </Modal>

      {/* ───── Usar template ───── */}
      <Modal open={templateModal} onClose={() => setTemplateModal(false)} title="Criar a partir de template" size="sm">
        <div className="space-y-2">
          {templates.map((t) => (
            <button
              key={t.id}
              className="card flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold hover:border-blue-500"
              onClick={async () => {
                const ref = await projectFromTemplate(api, t);
                toast('Projeto criado a partir do template.');
                setTemplateModal(false);
                navigate(`/projetos/${ref.id}`);
              }}
            >
              <span className="flex items-center gap-2">
                <FilePlus2 size={16} className="text-blue-500" /> {t.name}
              </span>
              <span className="muted text-xs">{(t.data?.parts || []).length} parte(s)</span>
            </button>
          ))}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Excluir projeto"
        message={`Excluir "${confirm?.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={async () => {
          await api.remove('projects', confirm.id, confirm.name);
          toast('Projeto excluído.');
        }}
      />
    </div>
  );
}
