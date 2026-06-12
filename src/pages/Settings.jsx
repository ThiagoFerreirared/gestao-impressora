import { useState } from 'react';
import { Download, Plus, Save, Upload } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import Tabs from '../components/ui/Tabs';
import { FormGrid, Input, Textarea } from '../components/ui/Field';
import { exportJSON } from '../lib/export';
import { dateTimeBR, money, toNum, uid } from '../lib/format';
import { MAINTENANCE_TYPES } from '../lib/constants';
import { addSpoolWithExpense } from '../lib/ops';

export default function Settings() {
  const [tab, setTab] = useState('geral');
  const { activity } = useData();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Configurações</h1>
        <p className="muted text-sm">Parâmetros usados em todos os cálculos do sistema</p>
      </div>

      <Tabs
        tabs={[
          { key: 'geral', label: 'Geral' },
          { key: 'listas', label: 'Materiais & marcas' },
          { key: 'checklists', label: 'Checklists' },
          { key: 'backup', label: 'Backup' },
          { key: 'importar', label: 'Importar' },
          { key: 'log', label: 'Log de alterações', count: activity.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'geral' && <GeneralTab />}
      {tab === 'listas' && <ListsTab />}
      {tab === 'checklists' && <ChecklistsTab />}
      {tab === 'backup' && <BackupTab />}
      {tab === 'importar' && <ImportTab />}
      {tab === 'log' && <LogTab />}
    </div>
  );
}

// ───────────────────────── Geral ─────────────────────────

function GeneralTab() {
  const { settings, api } = useData();
  const toast = useToast();
  const [form, setForm] = useState({
    businessName: settings.businessName || '',
    energyTariff: String(settings.energyTariff ?? ''),
    printerWattsDefault: String(settings.printerWattsDefault ?? ''),
    marginSale: String(settings.margins?.sale ?? 50),
    marginResale: String(settings.margins?.resale ?? 35),
    marginWholesale: String(settings.margins?.wholesale ?? 25),
    laborRate: String(settings.laborRate ?? ''),
    lowStockDefault: String(settings.lowStockDefault ?? 100),
  });

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const save = async () => {
    await api.setSettings({
      businessName: form.businessName.trim() || 'Minha Operação 3D',
      energyTariff: toNum(form.energyTariff),
      printerWattsDefault: toNum(form.printerWattsDefault) || 400,
      margins: {
        sale: toNum(form.marginSale),
        resale: toNum(form.marginResale),
        wholesale: toNum(form.marginWholesale),
      },
      laborRate: toNum(form.laborRate),
      lowStockDefault: toNum(form.lowStockDefault) || 100,
    });
    toast('Configurações salvas.');
  };

  return (
    <div className="card-pad max-w-3xl space-y-4">
      <FormGrid cols={2}>
        <Input label="Nome do negócio / marca" name="businessName" value={form.businessName} onChange={set} />
        <Input label="Tarifa de energia (R$/kWh)" name="energyTariff" inputMode="decimal" value={form.energyTariff} onChange={set}
          hint="Veja na sua conta de luz — usada no custo de energia de cada impressão" />
        <Input label="Consumo médio da impressora (W)" name="printerWattsDefault" inputMode="numeric" value={form.printerWattsDefault} onChange={set}
          hint="Padrão 400W (A1 com mesa aquecida). Pode ser sobrescrito por impressora" />
        <Input label="Mão de obra (R$/hora)" name="laborRate" inputMode="decimal" value={form.laborRate} onChange={set}
          hint="Usada no orçamento e nas etapas de pós-processamento" />
        <Input label="Margem padrão — venda (%)" name="marginSale" inputMode="decimal" value={form.marginSale} onChange={set} />
        <Input label="Margem padrão — revenda (%)" name="marginResale" inputMode="decimal" value={form.marginResale} onChange={set} />
        <Input label="Margem padrão — atacado (%)" name="marginWholesale" inputMode="decimal" value={form.marginWholesale} onChange={set} />
        <Input label="Alerta de estoque baixo padrão (g)" name="lowStockDefault" inputMode="numeric" value={form.lowStockDefault} onChange={set}
          hint="Aplicado a novas bobinas (cada bobina pode ter o seu)" />
      </FormGrid>
      <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
        Exemplo com os valores atuais: 1h de impressão a {form.printerWattsDefault || 400}W ×{' '}
        {money(toNum(form.energyTariff))}/kWh = {money(((toNum(form.printerWattsDefault) || 400) / 1000) * toNum(form.energyTariff))} de energia.
        Preço sugerido = custo ÷ (1 − margem%).
      </div>
      <div className="flex justify-end">
        <button className="btn-primary" onClick={save}><Save size={15} /> Salvar configurações</button>
      </div>
    </div>
  );
}

// ───────────────────────── Materiais & marcas personalizados ─────────────────────────

function ListEditor({ title, hint, items, value, setValue, onAdd, onRemove }) {
  return (
    <div className="card-pad space-y-3">
      <h3 className="section-title">{title}</h3>
      <p className="text-xs text-slate-400">{hint}</p>
      <div className="flex gap-2">
        <input className="input flex-1" value={value} onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAdd()} placeholder="Novo item..." />
        <button className="btn-primary" onClick={onAdd}><Plus size={15} /></button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.length === 0 && <p className="text-sm text-slate-400">Nenhum item personalizado.</p>}
        {items.map((item) => (
          <span key={item} className="badge-blue !px-2.5 !py-1 !text-xs">
            {item}
            <button className="ml-1 hover:text-red-500" onClick={() => onRemove(item)}>×</button>
          </span>
        ))}
      </div>
    </div>
  );
}

function ListsTab() {
  const { settings, api } = useData();
  const toast = useToast();
  const [newMaterial, setNewMaterial] = useState('');
  const [newBrand, setNewBrand] = useState('');

  const addTo = async (key, value, clear) => {
    const v = value.trim();
    if (!v) return;
    const list = [...(settings[key] || [])];
    if (list.includes(v)) return toast('Já existe na lista.', 'warning');
    await api.setSettings({ [key]: [...list, v] });
    toast('Adicionado.');
    clear('');
  };

  const removeFrom = async (key, value) => {
    await api.setSettings({ [key]: (settings[key] || []).filter((x) => x !== value) });
    toast('Removido.');
  };

  return (
    <div className="grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
      <ListEditor
        title="Materiais personalizados"
        hint="Somados aos materiais da Biblioteca nas listas de seleção de bobinas. Para cadastrar com propriedades (temperaturas etc.), use Biblioteca → Materiais."
        items={settings.customMaterials || []}
        value={newMaterial}
        setValue={setNewMaterial}
        onAdd={() => addTo('customMaterials', newMaterial, setNewMaterial)}
        onRemove={(v) => removeFrom('customMaterials', v)}
      />
      <ListEditor
        title="Marcas personalizadas"
        hint="Somadas às marcas padrão (Bambu Lab, Polymaker, Esun, Elegoo, Hatchbox, Voolt3D...) no cadastro de bobinas."
        items={settings.customBrands || []}
        value={newBrand}
        setValue={setNewBrand}
        onAdd={() => addTo('customBrands', newBrand, setNewBrand)}
        onRemove={(v) => removeFrom('customBrands', v)}
      />
    </div>
  );
}

// ───────────────────────── Checklists ─────────────────────────

function ChecklistsTab() {
  const { settings, api } = useData();
  const toast = useToast();
  const [pre, setPre] = useState((settings.preChecklist || []).join('\n'));
  const [post, setPost] = useState((settings.postChecklist || []).join('\n'));

  const save = async () => {
    await api.setSettings({
      preChecklist: pre.split('\n').map((l) => l.trim()).filter(Boolean),
      postChecklist: post.split('\n').map((l) => l.trim()).filter(Boolean),
    });
    toast('Checklists salvos.');
  };

  return (
    <div className="card-pad max-w-3xl space-y-4">
      <FormGrid cols={2}>
        <Textarea label="Checklist pré-impressão (um item por linha)" rows={8} value={pre} onChange={(e) => setPre(e.target.value)} />
        <Textarea label="Checklist pós-impressão (um item por linha)" rows={8} value={post} onChange={(e) => setPost(e.target.value)} />
      </FormGrid>
      <p className="text-xs text-slate-400">Exibidos ao iniciar e concluir impressões na página Produção.</p>
      <div className="flex justify-end">
        <button className="btn-primary" onClick={save}><Save size={15} /> Salvar checklists</button>
      </div>
    </div>
  );
}

// ───────────────────────── Backup ─────────────────────────

function BackupTab() {
  const data = useData();
  const toast = useToast();

  const doBackup = () => {
    exportJSON(`backup-gestao3d-${new Date().toISOString().slice(0, 10)}`, {
      exportedAt: new Date().toISOString(),
      settings: data.settings,
      printers: data.printers,
      spools: data.spools,
      projects: data.projects,
      clients: data.clients,
      orders: data.orders,
      transactions: data.transactions,
      maintenanceRecords: data.maintenanceRecords,
      maintenanceParts: data.maintenanceParts,
      profiles: data.profiles,
      materials: data.materials,
      suppliers: data.suppliers,
      templates: data.templates,
      packagingItems: data.packagingItems,
    });
    toast('Backup completo baixado em JSON.');
  };

  return (
    <div className="card-pad max-w-2xl space-y-4">
      <h3 className="section-title">Backup e exportação de todos os dados</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Baixa um arquivo JSON com tudo o que está no seu Firestore: configurações, impressoras, bobinas (com histórico),
        projetos, clientes, pedidos, financeiro, manutenções, biblioteca e insumos. Guarde em local seguro.
      </p>
      <button className="btn-primary" onClick={doBackup}>
        <Download size={16} /> Baixar backup completo (.json)
      </button>
      <p className="text-xs text-slate-400">
        Dica: os dados também ficam protegidos no Firebase. Para exportar tabelas específicas em Excel/PDF, use as páginas
        Financeiro e Relatórios.
      </p>
    </div>
  );
}

// ───────────────────────── Importar ─────────────────────────

function ImportTab() {
  const { api } = useData();
  const toast = useToast();
  const [raw, setRaw] = useState('');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const parse = () => {
    setError('');
    setPreview(null);
    try {
      const json = JSON.parse(raw.trim());
      const printers = Array.isArray(json.printers) ? json.printers : [];
      const spools = Array.isArray(json.spools) ? json.spools : [];
      if (printers.length === 0 && spools.length === 0) {
        setError('Nenhum dado encontrado. Verifique se o JSON tem os campos "printers" e/ou "spools".');
        return;
      }
      setPreview({ printers, spools });
    } catch {
      setError('JSON inválido. Verifique o texto colado.');
    }
  };

  const execute = async () => {
    if (!preview) return;
    setBusy(true);
    let added = 0;
    try {
      for (const p of preview.printers) {
        const data = {
          name: p.name || 'Impressora importada',
          model: p.model || '',
          serial: p.serial || '',
          purchaseDate: p.purchaseDate || '',
          purchasePrice: Number(p.purchasePrice) || 0,
          lifespanHours: Number(p.lifespanHours) || 5000,
          hoursUsed: Number(p.hoursUsed) || 0,
          watts: Number(p.watts) || null,
          status: p.status || 'ativa',
          notes: p.notes || '',
          schedules: MAINTENANCE_TYPES.map((m) => ({
            id: uid(),
            type: m.type,
            intervalHours: m.intervalHours,
            lastDoneHours: Number(p.hoursUsed) || 0,
            lastDoneDate: '',
          })),
        };
        await api.add('printers', data, data.name);
        added++;
      }
      for (const s of preview.spools) {
        const data = {
          brand: s.brand || '',
          material: s.material || '',
          colorName: s.colorName || '',
          colorHex: s.colorHex || '#888888',
          finish: s.finish || 'Basic',
          diameter: s.diameter || '1.75',
          initialWeight: Number(s.initialWeight) || 1000,
          currentWeight: Number(s.currentWeight ?? s.initialWeight) || 1000,
          price: Number(s.price) || 0,
          supplier: s.supplier || '',
          purchaseDate: s.purchaseDate || '',
          batch: s.batch || '',
          location: s.location || '',
          alertThreshold: Number(s.alertThreshold) || 100,
          reorderPlaced: false,
          notes: s.notes || '',
        };
        await addSpoolWithExpense(api, data);
        added++;
      }
      toast(`${added} item(ns) importado(s) com sucesso!`);
      setRaw('');
      setPreview(null);
    } catch (err) {
      toast(`Erro na importação: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card-pad max-w-3xl space-y-4">
      <h3 className="section-title">Importação rápida de compras</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Cole abaixo o JSON com as impressoras e/ou bobinas que deseja adicionar. O sistema vai pré-visualizar o que será importado antes de confirmar.
      </p>

      <textarea
        className="input min-h-[160px] font-mono text-xs"
        placeholder={'{\n  "printers": [...],\n  "spools": [...]\n}'}
        value={raw}
        onChange={(e) => { setRaw(e.target.value); setPreview(null); setError(''); }}
      />

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500 dark:bg-red-500/10">{error}</p>}

      <button className="btn-secondary" onClick={parse} disabled={!raw.trim()}>
        <Upload size={15} /> Pré-visualizar importação
      </button>

      {preview && (
        <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/20 dark:bg-blue-500/10">
          <p className="font-semibold text-blue-700 dark:text-blue-300">
            Pronto para importar: {preview.printers.length} impressora(s) · {preview.spools.length} bobina(s)
          </p>

          {preview.printers.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">Impressoras</p>
              <ul className="space-y-1">
                {preview.printers.map((p, i) => (
                  <li key={i} className="text-sm">
                    <b>{p.name}</b> — {p.model} · {money(p.purchasePrice)} · {p.purchaseDate}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview.spools.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">Bobinas</p>
              <ul className="space-y-1">
                {preview.spools.map((s, i) => (
                  <li key={i} className="text-sm">
                    <b>{s.brand} {s.material}</b> {s.colorName} · {s.diameter}mm · {money(s.price)} · {s.purchaseDate}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button className="btn-primary" onClick={execute} disabled={busy}>
              {busy ? 'Importando...' : 'Confirmar importação'}
            </button>
            <button className="btn-secondary" onClick={() => { setPreview(null); setRaw(''); }}>Cancelar</button>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">
        As despesas de compra das bobinas são lançadas automaticamente no Financeiro. As impressoras recebem a agenda de manutenção padrão.
      </p>
    </div>
  );
}

// ───────────────────────── Log ─────────────────────────

function LogTab() {
  const { activity } = useData();
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h3 className="section-title">Últimas 300 alterações</h3>
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="table-base">
          <thead><tr><th>Quando</th><th>Ação</th><th>Onde</th><th>O quê</th><th>Detalhe</th></tr></thead>
          <tbody>
            {activity.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap text-xs">{dateTimeBR(a.at)}</td>
                <td>
                  <span className={a.action === 'excluiu' ? 'badge-red' : a.action === 'criou' ? 'badge-green' : 'badge-blue'}>
                    {a.action}
                  </span>
                </td>
                <td className="text-xs text-slate-400">{a.entity}</td>
                <td className="font-medium">{a.label}</td>
                <td className="text-xs text-slate-400">{a.detail || '—'}</td>
              </tr>
            ))}
            {activity.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-400">Nenhuma atividade registrada ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
