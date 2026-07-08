import { useState } from 'react';
import { Download, Plus, Save, Upload } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import Tabs from '../components/ui/Tabs';
import { FormGrid, Input, Textarea } from '../components/ui/Field';
import { exportJSON } from '../lib/export';
import { dateTimeBR, money, toNum, uid } from '../lib/format';
import { MAINTENANCE_TYPES } from '../lib/constants';
import { marginsForCategory } from '../lib/calculations';
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
    failureRatePct: String(settings.failureRatePct ?? 10),
    lowStockDefault: String(settings.lowStockDefault ?? 100),
    taxRatePct: String(settings.taxRatePct ?? 0),
    lowStockProductDefault: String(settings.lowStockProductDefault ?? 3),
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
      failureRatePct: toNum(form.failureRatePct),
      lowStockDefault: toNum(form.lowStockDefault) || 100,
      taxRatePct: toNum(form.taxRatePct),
      lowStockProductDefault: toNum(form.lowStockProductDefault) || 3,
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
        <Input label="Reserva para falhas (%)" name="failureRatePct" inputMode="decimal" value={form.failureRatePct} onChange={set}
          hint="Acréscimo no custo p/ cobrir impressões que falham — aplicado sobre filamento + energia + máquina" />
        <Input label="Margem padrão — venda (%)" name="marginSale" inputMode="decimal" value={form.marginSale} onChange={set} />
        <Input label="Margem padrão — revenda (%)" name="marginResale" inputMode="decimal" value={form.marginResale} onChange={set} />
        <Input label="Margem padrão — atacado (%)" name="marginWholesale" inputMode="decimal" value={form.marginWholesale} onChange={set} />
        <Input label="Alerta de estoque baixo padrão (g)" name="lowStockDefault" inputMode="numeric" value={form.lowStockDefault} onChange={set}
          hint="Aplicado a novas bobinas (cada bobina pode ter o seu)" />
        <Input label="Imposto padrão — IVA/Simples (%)" name="taxRatePct" inputMode="decimal" value={form.taxRatePct} onChange={set}
          hint="Sugerido automaticamente no assistente de Vendas (editável por venda)" />
        <Input label="Alerta de estoque baixo padrão — produtos (un.)" name="lowStockProductDefault" inputMode="numeric" value={form.lowStockProductDefault} onChange={set}
          hint="Aplicado a novos produtos cadastrados em Produtos & Estoque" />
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
  const { api, spools, printers, settings } = useData();
  const toast = useToast();
  const [raw, setRaw] = useState('');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const findSpool = (material, colorName, brand) =>
    spools.find((sp) =>
      sp.material?.toLowerCase() === material?.toLowerCase() &&
      sp.colorName?.toLowerCase() === colorName?.toLowerCase() &&
      (!brand || sp.brand?.toLowerCase() === brand?.toLowerCase())
    );

  const findPrinter = (name) =>
    printers.find((p) =>
      p.name?.toLowerCase().includes(name?.toLowerCase()) ||
      p.model?.toLowerCase().includes(name?.toLowerCase())
    );

  const parse = () => {
    setError('');
    setPreview(null);
    try {
      const json = JSON.parse(raw.trim());
      const importPrinters = Array.isArray(json.printers) ? json.printers : [];
      const importSpools = Array.isArray(json.spools) ? json.spools : [];
      const importProjects = Array.isArray(json.projects) ? json.projects : [];

      if (!importPrinters.length && !importSpools.length && !importProjects.length) {
        setError('Nenhum dado encontrado. O JSON deve ter os campos "printers", "spools" e/ou "projects".');
        return;
      }

      const warnings = [];
      const resolvedProjects = importProjects.map((proj) => {
        const parts = (proj.parts || []).map((part) => {
          const printer = part.printerName ? findPrinter(part.printerName) : null;
          if (part.printerName && !printer)
            warnings.push(`Impressora "${part.printerName}" não encontrada — verifique o nome exato.`);

          const slots = (part.slots || []).map((s) => {
            const spool = findSpool(s.material, s.colorName, s.brand);
            if (!spool)
              warnings.push(`Bobina "${s.brand || ''} ${s.material} ${s.colorName}" não encontrada.`);
            return { ...s, spoolId: spool?.id || '' };
          });

          return { ...part, printerId: printer?.id || '', resolvedPrinterName: printer?.name || part.printerName || '', slots };
        });
        return { ...proj, parts };
      });

      setPreview({ printers: importPrinters, spools: importSpools, projects: resolvedProjects, warnings });
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
        await api.add('printers', {
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
            id: uid(), type: m.type, intervalHours: m.intervalHours,
            lastDoneHours: Number(p.hoursUsed) || 0, lastDoneDate: '',
          })),
        }, p.name);
        added++;
      }

      for (const s of preview.spools) {
        await addSpoolWithExpense(api, {
          brand: s.brand || '', material: s.material || '',
          colorName: s.colorName || '', colorHex: s.colorHex || '#888888',
          finish: s.finish || 'Basic', diameter: s.diameter || '1.75',
          initialWeight: Number(s.initialWeight) || 1000,
          currentWeight: Number(s.currentWeight ?? s.initialWeight) || 1000,
          price: Number(s.price) || 0, supplier: s.supplier || '',
          purchaseDate: s.purchaseDate || '', batch: s.batch || '',
          location: s.location || '', alertThreshold: Number(s.alertThreshold) || 100,
          reorderPlaced: false, notes: s.notes || '',
        });
        added++;
      }

      for (const proj of preview.projects) {
        const parts = (proj.parts || []).map((part) => ({
          id: uid(),
          name: part.name || 'Parte 1',
          quantity: Number(part.quantity) || 1,
          printerId: part.printerId || '',
          estMinutes: Number(part.estMinutes) || 0,
          slots: (part.slots || []).map((s) => ({
            slot: s.slot, spoolId: s.spoolId || '',
            gramsPiece: Number(s.gramsPiece) || 0, gramsPurge: Number(s.gramsPurge) || 0,
          })),
          sliceData: { fileName: '', profileName: '', layerHeight: '', filamentWeight: '' },
          prodStatus: 'pendente', attempts: 0,
          startedAt: null, finishedAt: null, realMinutes: 0, realSlots: [],
        }));

        const bgt = proj.budget || {};
        const categoryMargins = marginsForCategory(proj.category || 'Personalizado', settings.margins);
        await api.add('projects', {
          name: proj.name || 'Projeto importado',
          clientId: proj.clientId || '',
          category: proj.category || 'Personalizado',
          priority: proj.priority || 'normal',
          status: proj.status || 'orcamento',
          deadline: proj.deadline || '',
          description: proj.description || '',
          scale: proj.scale || '100%',
          isTest: !!proj.isTest,
          tags: [], files: [], images: [],
          notes: proj.notes || '',
          parts, failures: [], postSteps: [], quality: '', photos: [],
          budget: {
            laborMode: bgt.laborMode || 'hourly',
            laborHours: Number(bgt.laborHours) || 0,
            laborFixed: Number(bgt.laborFixed) || 0,
            finishing: (bgt.finishing || []).map((f) => ({ desc: f.desc || '', value: Number(f.value) || 0 })),
            packagingCost: Number(bgt.packagingCost) || 0,
            shippingCost: Number(bgt.shippingCost) || 0,
            failureRate: Number(bgt.failureRate ?? settings.failureRatePct ?? 10),
            margins: {
              sale: Number(bgt.margins?.sale ?? categoryMargins.sale),
              resale: Number(bgt.margins?.resale ?? categoryMargins.resale),
              wholesale: Number(bgt.margins?.wholesale ?? categoryMargins.wholesale),
            },
            promoDiscount: Number(bgt.promoDiscount) || 0,
            manualPrice: bgt.manualPrice != null ? Number(bgt.manualPrice) : null,
            priceHistory: [], estimateSnapshot: null,
            channel: {
              name: bgt.channel?.name || 'Direto',
              commissionPct: Number(bgt.channel?.commissionPct) || 0,
              fixedFee: Number(bgt.channel?.fixedFee) || 0,
            },
          },
        }, proj.name);
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
      <h3 className="section-title">Importação rápida</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Cole o JSON com impressoras, bobinas e/ou projetos. O sistema pré-visualiza e resolve automaticamente as referências antes de confirmar.
      </p>

      <textarea
        className="input min-h-[160px] font-mono text-xs"
        placeholder={'{\n  "printers": [...],\n  "spools": [...],\n  "projects": [...]\n}'}
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
            Pronto para importar: {preview.printers.length} impressora(s) · {preview.spools.length} bobina(s) · {preview.projects.length} projeto(s)
          </p>

          {preview.warnings?.length > 0 && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-500/10">
              <p className="mb-1 text-xs font-semibold text-amber-600">Avisos — verifique antes de confirmar:</p>
              <ul className="space-y-0.5">
                {preview.warnings.map((w, i) => <li key={i} className="text-xs text-amber-600">• {w}</li>)}
              </ul>
            </div>
          )}

          {preview.printers.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Impressoras</p>
              <ul className="space-y-1">
                {preview.printers.map((p, i) => (
                  <li key={i} className="text-sm"><b>{p.name}</b> — {p.model} · {money(p.purchasePrice)} · {p.purchaseDate}</li>
                ))}
              </ul>
            </div>
          )}

          {preview.spools.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Bobinas</p>
              <ul className="space-y-1">
                {preview.spools.map((s, i) => (
                  <li key={i} className="text-sm"><b>{s.brand} {s.material}</b> {s.colorName} · {s.diameter}mm · {money(s.price)} · {s.purchaseDate}</li>
                ))}
              </ul>
            </div>
          )}

          {preview.projects.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Projetos</p>
              <ul className="space-y-2">
                {preview.projects.map((proj, i) => (
                  <li key={i} className="text-sm">
                    <b>{proj.name}</b>
                    <ul className="ml-3 mt-0.5 space-y-0.5">
                      {(proj.parts || []).map((part, j) => (
                        <li key={j} className="text-xs text-slate-500">
                          {part.name} · {part.resolvedPrinterName} · {part.estMinutes}min ·{' '}
                          {part.slots.map((s) => `${s.colorName || s.material} ${s.gramsPiece}g`).join(', ')}
                        </li>
                      ))}
                    </ul>
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
        Bobinas: despesas lançadas no Financeiro · Impressoras: agenda de manutenção criada · Projetos: bobinas e impressora resolvidas pelo nome automaticamente
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
