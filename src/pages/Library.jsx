import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePlus2, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import DataTable from '../components/ui/DataTable';
import Tabs from '../components/ui/Tabs';
import { FormGrid, Input, Select, Textarea } from '../components/ui/Field';
import { projectFromTemplate } from '../lib/ops';
import { money, toNum } from '../lib/format';

export default function Library() {
  const { profiles, materials, suppliers, templates } = useData();
  const [tab, setTab] = useState('perfis');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Biblioteca</h1>
        <p className="muted text-sm">Perfis de impressão, materiais, fornecedores e templates reutilizáveis</p>
      </div>

      <Tabs
        tabs={[
          { key: 'perfis', label: 'Perfis de impressão', count: profiles.length },
          { key: 'materiais', label: 'Materiais', count: materials.length },
          { key: 'fornecedores', label: 'Fornecedores', count: suppliers.length },
          { key: 'templates', label: 'Templates', count: templates.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'perfis' && <ProfilesTab />}
      {tab === 'materiais' && <MaterialsTab />}
      {tab === 'fornecedores' && <SuppliersTab />}
      {tab === 'templates' && <TemplatesTab />}
    </div>
  );
}

// ───────────────────────── Perfis ─────────────────────────

const EMPTY_PROFILE = { name: '', material: '', layerHeight: '0.2', infill: '15', walls: '2', nozzleTemp: '', bedTemp: '', speed: '', notes: '' };

function ProfilesTab() {
  const { profiles, materialNames, api } = useData();
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_PROFILE);
  const [confirm, setConfirm] = useState(null);

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const save = async () => {
    if (!form.name.trim()) return toast('Informe o nome do perfil.', 'warning');
    const data = { ...form, name: form.name.trim() };
    if (modal.id) await api.update('profiles', modal.id, data);
    else await api.add('profiles', data);
    toast('Perfil salvo.');
    setModal(null);
  };

  return (
    <>
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => { setForm(EMPTY_PROFILE); setModal({}); }}>
          <Plus size={16} /> Novo perfil
        </button>
      </div>
      <DataTable
        data={profiles}
        searchKeys={['name', 'material']}
        searchPlaceholder="Buscar perfil..."
        columns={[
          { key: 'name', label: 'Perfil', sortValue: (r) => r.name, render: (r) => <span className="font-semibold">{r.name}</span> },
          { key: 'material', label: 'Material', sortValue: (r) => r.material || '', render: (r) => r.material || '—' },
          { key: 'layerHeight', label: 'Camada', render: (r) => `${r.layerHeight} mm` },
          { key: 'infill', label: 'Infill', render: (r) => `${r.infill}%` },
          { key: 'walls', label: 'Paredes', render: (r) => r.walls },
          { key: 'temps', label: 'Bico / Mesa', render: (r) => `${r.nozzleTemp || '—'}°C / ${r.bedTemp || '—'}°C` },
          { key: 'speed', label: 'Velocidade', render: (r) => (r.speed ? `${r.speed} mm/s` : '—') },
        ]}
        emptyTitle="Nenhum perfil salvo"
        emptyMessage="Salve seus perfis do Bambu Studio para aplicar rapidamente nas partes dos projetos."
        rowActions={(r) => (
          <>
            <button className="btn-icon" onClick={() => { setForm({ ...EMPTY_PROFILE, ...r }); setModal({ id: r.id }); }}>
              <Pencil size={15} />
            </button>
            <button className="btn-icon hover:!text-red-500" onClick={() => setConfirm(r)}>
              <Trash2 size={15} />
            </button>
          </>
        )}
      />

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? 'Editar perfil' : 'Novo perfil de impressão'}
        footer={<><button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
          <button className="btn-primary" onClick={save}>Salvar</button></>}>
        <FormGrid cols={2}>
          <Input label="Nome *" name="name" value={form.name} onChange={set} placeholder="Ex: 0.20mm Standard PLA" />
          <Select label="Material" name="material" value={form.material} onChange={set} placeholder="Qualquer" options={materialNames} />
          <Input label="Altura de camada (mm)" name="layerHeight" value={form.layerHeight} onChange={set} />
          <Input label="Infill (%)" name="infill" value={form.infill} onChange={set} />
          <Input label="Paredes" name="walls" value={form.walls} onChange={set} />
          <Input label="Velocidade (mm/s)" name="speed" value={form.speed} onChange={set} />
          <Input label="Temp. bico (°C)" name="nozzleTemp" value={form.nozzleTemp} onChange={set} />
          <Input label="Temp. mesa (°C)" name="bedTemp" value={form.bedTemp} onChange={set} />
        </FormGrid>
        <div className="mt-3.5">
          <Textarea label="Observações" name="notes" value={form.notes} onChange={set} rows={2} />
        </div>
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} title="Excluir perfil"
        message={`Excluir "${confirm?.name}"?`}
        onConfirm={async () => { await api.remove('profiles', confirm.id, confirm.name); toast('Perfil excluído.'); }} />
    </>
  );
}

// ───────────────────────── Materiais ─────────────────────────

const EMPTY_MATERIAL = { name: '', nozzleMin: '', nozzleMax: '', bedMin: '', bedMax: '', speedMax: '', traits: '' };

function MaterialsTab() {
  const { materials, api } = useData();
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_MATERIAL);
  const [confirm, setConfirm] = useState(null);

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const save = async () => {
    if (!form.name.trim()) return toast('Informe o nome do material.', 'warning');
    const data = {
      name: form.name.trim(),
      nozzleMin: toNum(form.nozzleMin),
      nozzleMax: toNum(form.nozzleMax),
      bedMin: toNum(form.bedMin),
      bedMax: toNum(form.bedMax),
      speedMax: toNum(form.speedMax),
      traits: form.traits,
    };
    if (modal.id) await api.update('materials', modal.id, data);
    else await api.add('materials', { ...data, builtin: false });
    toast('Material salvo.');
    setModal(null);
  };

  return (
    <>
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => { setForm(EMPTY_MATERIAL); setModal({}); }}>
          <Plus size={16} /> Material personalizado
        </button>
      </div>
      <DataTable
        data={materials}
        searchKeys={['name', 'traits']}
        searchPlaceholder="Buscar material..."
        columns={[
          {
            key: 'name', label: 'Material', sortValue: (r) => r.name,
            render: (r) => (
              <span className="font-semibold">
                {r.name} {r.builtin && <span className="badge-gray ml-1">padrão</span>}
              </span>
            ),
          },
          { key: 'nozzle', label: 'Bico (°C)', render: (r) => `${r.nozzleMin}–${r.nozzleMax}` },
          { key: 'bed', label: 'Mesa (°C)', render: (r) => `${r.bedMin}–${r.bedMax}` },
          { key: 'speedMax', label: 'Vel. máx', render: (r) => (r.speedMax ? `${r.speedMax} mm/s` : '—') },
          { key: 'traits', label: 'Características', render: (r) => <span className="text-xs text-slate-400">{r.traits}</span> },
        ]}
        initialSort={{ key: 'name', dir: 'asc' }}
        emptyTitle="Biblioteca de materiais vazia"
        rowActions={(r) => (
          <>
            <button className="btn-icon" onClick={() => { setForm({ ...EMPTY_MATERIAL, ...r }); setModal({ id: r.id }); }}>
              <Pencil size={15} />
            </button>
            <button className="btn-icon hover:!text-red-500" onClick={() => setConfirm(r)}>
              <Trash2 size={15} />
            </button>
          </>
        )}
      />

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? 'Editar material' : 'Novo material'}
        footer={<><button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
          <button className="btn-primary" onClick={save}>Salvar</button></>}>
        <FormGrid cols={2}>
          <Input label="Nome *" name="name" value={form.name} onChange={set} placeholder="Ex: PLA Wood" />
          <Input label="Velocidade máx (mm/s)" name="speedMax" inputMode="numeric" value={form.speedMax} onChange={set} />
          <Input label="Bico mín (°C)" name="nozzleMin" inputMode="numeric" value={form.nozzleMin} onChange={set} />
          <Input label="Bico máx (°C)" name="nozzleMax" inputMode="numeric" value={form.nozzleMax} onChange={set} />
          <Input label="Mesa mín (°C)" name="bedMin" inputMode="numeric" value={form.bedMin} onChange={set} />
          <Input label="Mesa máx (°C)" name="bedMax" inputMode="numeric" value={form.bedMax} onChange={set} />
        </FormGrid>
        <div className="mt-3.5">
          <Textarea label="Características" name="traits" value={form.traits} onChange={set} rows={2}
            placeholder="Ex: precisa secar antes de usar, bico endurecido..." />
        </div>
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} title="Excluir material"
        message={`Excluir "${confirm?.name}" da biblioteca? Bobinas já cadastradas com ele não são alteradas.`}
        onConfirm={async () => { await api.remove('materials', confirm.id, confirm.name); toast('Material excluído.'); }} />
    </>
  );
}

// ───────────────────────── Fornecedores ─────────────────────────

const EMPTY_SUPPLIER = { name: '', site: '', phone: '', deliveryDays: '', rating: '5', notes: '' };

function SuppliersTab() {
  const { suppliers, api } = useData();
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_SUPPLIER);
  const [confirm, setConfirm] = useState(null);

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const save = async () => {
    if (!form.name.trim()) return toast('Informe o nome do fornecedor.', 'warning');
    const data = { ...form, name: form.name.trim(), deliveryDays: toNum(form.deliveryDays), rating: toNum(form.rating) };
    if (modal.id) await api.update('suppliers', modal.id, data);
    else await api.add('suppliers', data);
    toast('Fornecedor salvo.');
    setModal(null);
  };

  return (
    <>
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => { setForm(EMPTY_SUPPLIER); setModal({}); }}>
          <Plus size={16} /> Novo fornecedor
        </button>
      </div>
      <DataTable
        data={suppliers}
        searchKeys={['name', 'site', 'phone']}
        searchPlaceholder="Buscar fornecedor..."
        columns={[
          { key: 'name', label: 'Fornecedor', sortValue: (r) => r.name, render: (r) => <span className="font-semibold">{r.name}</span> },
          {
            key: 'site', label: 'Site',
            render: (r) =>
              r.site ? (
                <a href={r.site.startsWith('http') ? r.site : `https://${r.site}`} target="_blank" rel="noreferrer"
                  className="text-blue-500 hover:underline" onClick={(e) => e.stopPropagation()}>
                  {r.site}
                </a>
              ) : '—',
          },
          { key: 'phone', label: 'Telefone', render: (r) => r.phone || '—' },
          { key: 'deliveryDays', label: 'Prazo médio', sortValue: (r) => Number(r.deliveryDays) || 0, render: (r) => (r.deliveryDays ? `${r.deliveryDays} dias` : '—') },
          {
            key: 'rating', label: 'Avaliação', sortValue: (r) => Number(r.rating) || 0,
            render: (r) => (
              <span className="flex items-center gap-0.5 text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={13} fill={i < Number(r.rating) ? 'currentColor' : 'none'} />
                ))}
              </span>
            ),
          },
        ]}
        emptyTitle="Nenhum fornecedor cadastrado"
        rowActions={(r) => (
          <>
            <button className="btn-icon" onClick={() => { setForm({ ...EMPTY_SUPPLIER, ...r, deliveryDays: String(r.deliveryDays ?? ''), rating: String(r.rating ?? '5') }); setModal({ id: r.id }); }}>
              <Pencil size={15} />
            </button>
            <button className="btn-icon hover:!text-red-500" onClick={() => setConfirm(r)}>
              <Trash2 size={15} />
            </button>
          </>
        )}
      />

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? 'Editar fornecedor' : 'Novo fornecedor'}
        footer={<><button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
          <button className="btn-primary" onClick={save}>Salvar</button></>}>
        <FormGrid cols={2}>
          <Input label="Nome *" name="name" value={form.name} onChange={set} />
          <Input label="Site" name="site" value={form.site} onChange={set} placeholder="loja.com.br" />
          <Input label="Telefone / WhatsApp" name="phone" value={form.phone} onChange={set} />
          <Input label="Prazo de entrega médio (dias)" name="deliveryDays" inputMode="numeric" value={form.deliveryDays} onChange={set} />
          <Select label="Avaliação" name="rating" value={form.rating} onChange={set}
            options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: '★'.repeat(n) + '☆'.repeat(5 - n) }))} />
        </FormGrid>
        <div className="mt-3.5">
          <Textarea label="Observações" name="notes" value={form.notes} onChange={set} rows={2} />
        </div>
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} title="Excluir fornecedor"
        message={`Excluir "${confirm?.name}"?`}
        onConfirm={async () => { await api.remove('suppliers', confirm.id, confirm.name); toast('Fornecedor excluído.'); }} />
    </>
  );
}

// ───────────────────────── Templates ─────────────────────────

function TemplatesTab() {
  const { templates, api } = useData();
  const toast = useToast();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(null);

  return (
    <>
      <p className="muted text-sm">
        Templates são criados a partir de um projeto (botão "Template" na página do projeto) e reutilizados quantas vezes quiser.
      </p>
      <DataTable
        data={templates}
        searchKeys={['name']}
        searchPlaceholder="Buscar template..."
        columns={[
          { key: 'name', label: 'Template', sortValue: (r) => r.name, render: (r) => <span className="font-semibold">{r.name}</span> },
          { key: 'parts', label: 'Partes', render: (r) => (r.data?.parts || []).length },
          { key: 'category', label: 'Categoria', render: (r) => r.data?.category || '—' },
        ]}
        emptyTitle="Nenhum template salvo"
        rowActions={(r) => (
          <>
            <button
              className="btn-secondary btn-sm"
              onClick={async () => {
                const ref = await projectFromTemplate(api, r);
                toast('Projeto criado a partir do template.');
                navigate(`/projetos/${ref.id}`);
              }}
            >
              <FilePlus2 size={13} /> Criar projeto
            </button>
            <button className="btn-icon hover:!text-red-500" onClick={() => setConfirm(r)}>
              <Trash2 size={15} />
            </button>
          </>
        )}
      />
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} title="Excluir template"
        message={`Excluir o template "${confirm?.name}"?`}
        onConfirm={async () => { await api.remove('templates', confirm.id, confirm.name); toast('Template excluído.'); }} />
    </>
  );
}
