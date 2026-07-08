import { useMemo, useState } from 'react';
import {
  Check,
  Coins,
  Minus,
  Package,
  Plus,
  Receipt,
  Store,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import DataTable from '../components/ui/DataTable';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';
import { Input } from '../components/ui/Field';
import { FEE_PRESETS, PRICE_TIERS } from '../lib/constants';
import { productPriceTiers, productSalesStats, productUnitCost, salePriceBreakdown } from '../lib/calculations';
import { registerSale, removeSale } from '../lib/ops';
import { dateBR, money, todayInput, toNum, uid as genId } from '../lib/format';

const STEPS = ['Cliente', 'Produto', 'Data', 'Custos', 'Preco'];

const emptyWizard = () => ({
  step: 0,
  clientId: '',
  productId: '',
  qty: 1,
  saleDate: todayInput(),
  costs: { labor: '', packaging: '', delivery: '', customCosts: [] },
  tierKey: 'padrao',
  useFixedPrice: false,
  marginPct: '40',
  fixedPrice: '',
  taxIncluded: false,
  taxRatePct: '',
  fees: [],
});

export default function Sales() {
  const { products, productsById, spoolsById, printersById, clients, clientsById, productSales, settings, api } = useData();
  const toast = useToast();
  const [wizard, setWizard] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const openWizard = () => setWizard({ ...emptyWizard(), taxRatePct: String(settings.taxRatePct ?? 0) });
  const closeWizard = () => setWizard(null);

  const rows = useMemo(
    () => productSales.map((s) => ({ ...s, _product: productsById[s.productId], _client: clientsById[s.clientId] })),
    [productSales, productsById, clientsById]
  );

  const stats = useMemo(() => productSalesStats(productSales), [productSales]);

  const sellableProducts = useMemo(() => products.filter((p) => (Number(p.stockQty) || 0) > 0), [products]);

  const selectedProduct = wizard ? productsById[wizard.productId] : null;
  const recipeCost = useMemo(
    () => (selectedProduct ? productUnitCost(selectedProduct, { spoolsById, printersById, settings }) : null),
    [selectedProduct, spoolsById, printersById, settings]
  );

  const unitCost = useMemo(() => {
    if (!wizard || !recipeCost) return 0;
    const base = recipeCost.filament + recipeCost.energy + recipeCost.machine + recipeCost.custom;
    const extra =
      toNum(wizard.costs.labor) + toNum(wizard.costs.packaging) + toNum(wizard.costs.delivery) +
      wizard.costs.customCosts.reduce((a, c) => a + toNum(c.value), 0);
    return base + extra;
  }, [wizard, recipeCost]);

  const tiers = useMemo(() => productPriceTiers(unitCost, PRICE_TIERS), [unitCost]);

  const pricing = useMemo(() => {
    if (!wizard) return null;
    const tier = tiers.find((t) => t.key === wizard.tierKey);
    return salePriceBreakdown({
      cost: unitCost,
      marginPct: wizard.useFixedPrice ? undefined : (wizard.tierKey === 'custom' ? toNum(wizard.marginPct) : tier?.marginPct),
      fixedPrice: wizard.useFixedPrice ? wizard.fixedPrice : undefined,
      taxRatePct: wizard.taxRatePct,
      taxIncluded: wizard.taxIncluded,
      fees: wizard.fees,
    });
  }, [wizard, unitCost, tiers]);

  const patch = (p) => setWizard((w) => ({ ...w, ...p }));
  const patchCosts = (p) => setWizard((w) => ({ ...w, costs: { ...w.costs, ...p } }));

  const pickTier = (key) => setWizard((w) => ({ ...w, tierKey: key, useFixedPrice: false, fixedPrice: '' }));
  const useMargin = (v) => setWizard((w) => ({ ...w, tierKey: 'custom', useFixedPrice: false, marginPct: v, fixedPrice: '' }));
  const useFixed = (v) => setWizard((w) => ({ ...w, tierKey: 'custom', useFixedPrice: true, fixedPrice: v }));

  const addSaleCustomCost = () =>
    setWizard((w) => ({ ...w, costs: { ...w.costs, customCosts: [...w.costs.customCosts, { id: genId(), label: '', value: '' }] } }));
  const updateSaleCustomCost = (i, p) =>
    setWizard((w) => ({
      ...w,
      costs: { ...w.costs, customCosts: w.costs.customCosts.map((c, j) => (j === i ? { ...c, ...p } : c)) },
    }));
  const removeSaleCustomCost = (i) =>
    setWizard((w) => ({ ...w, costs: { ...w.costs, customCosts: w.costs.customCosts.filter((_, j) => j !== i) } }));

  const addFee = (preset) =>
    setWizard((w) => ({
      ...w,
      fees: [...w.fees, preset ? { id: genId(), label: preset.name, type: 'pct', value: String(preset.commissionPct) } : { id: genId(), label: '', type: 'pct', value: '' }],
    }));
  const updateFee = (i, p) => setWizard((w) => ({ ...w, fees: w.fees.map((f, j) => (j === i ? { ...f, ...p } : f)) }));
  const removeFee = (i) => setWizard((w) => ({ ...w, fees: w.fees.filter((_, j) => j !== i) }));

  const canNext = () => {
    if (!wizard) return false;
    if (wizard.step === 0) return !!wizard.clientId;
    if (wizard.step === 1) return !!wizard.productId && wizard.qty >= 1 && wizard.qty <= (productsById[wizard.productId]?.stockQty || 0);
    if (wizard.step === 2) return !!wizard.saleDate;
    return true;
  };

  const save = async () => {
    const client = clientsById[wizard.clientId];
    try {
      await registerSale(api, {
        product: selectedProduct,
        clientId: wizard.clientId,
        clientName: client?.name || '',
        qty: wizard.qty,
        saleDate: wizard.saleDate,
        costs: {
          filament: recipeCost.filament,
          energy: recipeCost.energy,
          machine: recipeCost.machine,
          labor: toNum(wizard.costs.labor),
          packaging: toNum(wizard.costs.packaging),
          delivery: toNum(wizard.costs.delivery),
          customCosts: wizard.costs.customCosts,
        },
        pricing,
        notes: '',
      });
      toast('Venda registrada e lancada no Financeiro!');
      closeWizard();
    } catch (err) {
      toast(`Erro ao registrar venda: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Vendas</h1>
          <p className="muted text-sm">Venda produtos direto do estoque, com custo e preco calculados na hora</p>
        </div>
        <button className="btn-primary" onClick={openWizard} disabled={!products.length}>
          <Plus size={16} /> Nova venda
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Receipt} label="Vendas" value={stats.count} tone="blue" />
        <StatCard icon={Package} label="Unidades" value={stats.units} tone="cyan" />
        <StatCard icon={Coins} label="Faturado" value={money(stats.revenue)} tone="green" />
        <StatCard icon={TrendingUp} label="Lucro" value={money(stats.profit)} tone="purple" />
      </div>

      {!products.length ? (
        <EmptyState
          icon={Store}
          title="Cadastre um produto primeiro"
          message='Va em "Produtos" para criar uma receita (ex: chaveiro) e produzir o primeiro lote antes de vender.'
        />
      ) : (
        <DataTable
          data={rows}
          searchKeys={['productName', 'clientName']}
          searchPlaceholder="Buscar por produto ou cliente..."
          columns={[
            { key: 'date', label: 'Data', sortValue: (r) => r.saleDate, render: (r) => dateBR(r.saleDate) },
            { key: 'client', label: 'Cliente', render: (r) => r.clientName || 'sem cliente' },
            { key: 'product', label: 'Produto', render: (r) => `${r.qty}x ${r.productName}` },
            { key: 'cost', label: 'Custo', sortValue: (r) => r.pricing?.cost, render: (r) => money(r.pricing?.cost) },
            { key: 'price', label: 'Preco/un', sortValue: (r) => r.pricing?.finalPrice, render: (r) => <b>{money(r.pricing?.finalPrice)}</b> },
            { key: 'total', label: 'Total', sortValue: (r) => r.total, render: (r) => <b className="text-blue-500">{money(r.total)}</b> },
            { key: 'profit', label: 'Lucro', sortValue: (r) => r.pricing?.profit, render: (r) => <span className="text-green-500">{money((r.pricing?.profit || 0) * r.qty)}</span> },
          ]}
          initialSort={{ key: 'date', dir: 'desc' }}
          emptyTitle="Nenhuma venda registrada"
          emptyMessage='Clique em "Nova venda" para vender direto do estoque de produtos.'
          rowActions={(r) => (
            <button className="btn-icon hover:!text-red-500" title="Excluir (devolve ao estoque)" onClick={() => setConfirm(r)}>
              <Trash2 size={15} />
            </button>
          )}
        />
      )}

      <Modal
        open={!!wizard}
        onClose={closeWizard}
        title="Adicionar Venda"
        size="lg"
        footer={
          wizard && (
            <>
              {wizard.step > 0 && (
                <button className="btn-secondary" onClick={() => patch({ step: wizard.step - 1 })}>Voltar</button>
              )}
              <div className="mr-auto" />
              {wizard.step < STEPS.length - 1 ? (
                <button className="btn-primary" disabled={!canNext()} onClick={() => patch({ step: wizard.step + 1 })}>Seguinte</button>
              ) : (
                <button className="btn-primary" onClick={save}>Guardar</button>
              )}
            </>
          )
        }
      >
        {wizard && (
          <div className="space-y-4">
            <div className="flex gap-1.5">
              {STEPS.map((s, i) => (
                <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= wizard.step ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
              ))}
            </div>

            {wizard.step === 0 && (
              <div className="space-y-2">
                <h4 className="text-lg font-bold">Selecionar Cliente</h4>
                {!clients.length && (
                  <EmptyState icon={Users} title="Nenhum cliente cadastrado" message='Cadastre um cliente na aba "Clientes" antes de vender.' />
                )}
                {clients.map((c) => (
                  <button
                    key={c.id}
                    className={`flex w-full items-center justify-between rounded-lg border px-3.5 py-3 text-left text-sm font-medium transition ${
                      wizard.clientId === c.id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-200 dark:border-slate-700'
                    }`}
                    onClick={() => patch({ clientId: c.id })}
                  >
                    {c.name}
                    {wizard.clientId === c.id && <Check size={16} className="text-blue-500" />}
                  </button>
                ))}
              </div>
            )}

            {wizard.step === 1 && (
              <div className="space-y-2">
                <h4 className="text-lg font-bold">Selecionar Produto</h4>
                {selectedProduct && (
                  <div className="rounded-lg border border-blue-500 bg-blue-500/10 px-3.5 py-3">
                    <p className="text-xs text-slate-400">Selecionado</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{selectedProduct.name}</p>
                        <p className="text-xs text-slate-400">Estoque disponivel: {selectedProduct.stockQty}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button className="btn-icon" disabled={wizard.qty <= 1} onClick={() => patch({ qty: wizard.qty - 1 })}><Minus size={15} /></button>
                        <span className="w-6 text-center text-lg font-bold text-blue-500">{wizard.qty}</span>
                        <button className="btn-icon" disabled={wizard.qty >= selectedProduct.stockQty} onClick={() => patch({ qty: wizard.qty + 1 })}><Plus size={15} /></button>
                      </div>
                    </div>
                  </div>
                )}
                {sellableProducts.filter((p) => p.id !== wizard.productId).map((p) => (
                  <button
                    key={p.id}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3.5 py-3 text-left text-sm font-medium dark:border-slate-700"
                    onClick={() => patch({ productId: p.id, qty: 1 })}
                  >
                    <span>{p.name} <span className="ml-1 text-xs font-normal text-slate-400">({p.stockQty} disp.)</span></span>
                  </button>
                ))}
              </div>
            )}

            {wizard.step === 2 && (
              <div className="space-y-2">
                <h4 className="text-lg font-bold">Selecionar Data de Venda</h4>
                <Input type="date" value={wizard.saleDate} onChange={(e) => patch({ saleDate: e.target.value })} />
              </div>
            )}

            {wizard.step === 3 && recipeCost && (
              <div className="space-y-2">
                <h4 className="text-lg font-bold">Custos (por unidade)</h4>
                <Row label="Custo do Filamento" value={money(recipeCost.filament)} />
                <Row label="Custo da Eletricidade" value={money(recipeCost.energy)} />
                <Row label="Custo de Depreciacao" value={money(recipeCost.machine)} />
                <MoneyRow label="Custo de Mao de Obra" value={wizard.costs.labor} onChange={(v) => patchCosts({ labor: v })} />
                <MoneyRow label="Custo de Embalagem" value={wizard.costs.packaging} onChange={(v) => patchCosts({ packaging: v })} />
                <MoneyRow label="Custo de Entrega" value={wizard.costs.delivery} onChange={(v) => patchCosts({ delivery: v })} />

                <div className="flex items-center justify-between pt-1">
                  <p className="label !mb-0">Custos Personalizados</p>
                  <button className="btn-secondary btn-sm" onClick={addSaleCustomCost}><Plus size={13} /> Adicionar</button>
                </div>
                {wizard.costs.customCosts.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <input className="input flex-1" placeholder="Descricao" value={c.label} onChange={(e) => updateSaleCustomCost(i, { label: e.target.value })} />
                    <input className="input w-28" inputMode="decimal" placeholder="R$" value={c.value} onChange={(e) => updateSaleCustomCost(i, { value: e.target.value })} />
                    <button className="btn-icon" onClick={() => removeSaleCustomCost(i)}><Trash2 size={14} /></button>
                  </div>
                ))}

                <div className="mt-2 rounded-lg border border-blue-500/40 bg-blue-500/5 p-3">
                  <Row label="Custo do Material" value={money(recipeCost.filament)} muted />
                  <Row label="Custo da Eletricidade" value={money(recipeCost.energy)} muted />
                  <Row label="Custo de Depreciacao" value={money(recipeCost.machine)} muted />
                  {(toNum(wizard.costs.labor) + toNum(wizard.costs.packaging) + toNum(wizard.costs.delivery)) > 0 && (
                    <Row label="Mao de obra / Embalagem / Entrega" value={money(toNum(wizard.costs.labor) + toNum(wizard.costs.packaging) + toNum(wizard.costs.delivery))} muted />
                  )}
                  <div className="mt-1 flex justify-between border-t border-blue-500/30 pt-1.5 text-sm font-bold">
                    <span>Total</span>
                    <span className="text-blue-500">{money(unitCost)}</span>
                  </div>
                </div>
              </div>
            )}

            {wizard.step === 4 && pricing && (
              <div className="space-y-4">
                <h4 className="text-lg font-bold">Precos</h4>
                <div>
                  <p className="label">Precos Sugeridos</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {tiers.map((t) => (
                      <TierCard key={t.key} tier={t} selected={wizard.tierKey === t.key} taxRatePct={wizard.taxRatePct} onClick={() => pickTier(t.key)} />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="label">Preco Personalizado</p>
                  <Input label="Margem de Lucro (%)" inputMode="decimal" value={wizard.tierKey === 'custom' && !wizard.useFixedPrice ? wizard.marginPct : ''} onChange={(e) => useMargin(e.target.value)} />
                  <p className="my-1 text-center text-xs text-slate-400">OU</p>
                  <Input label="Preco de Venda (R$)" inputMode="decimal" value={wizard.useFixedPrice ? wizard.fixedPrice : ''} onChange={(e) => useFixed(e.target.value)} />
                  <div className="mt-2 flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                    <button className={`flex-1 py-1.5 text-sm font-semibold ${!wizard.taxIncluded ? 'bg-blue-500 text-white' : ''}`} onClick={() => patch({ taxIncluded: false })}>Excl. Imposto</button>
                    <button className={`flex-1 py-1.5 text-sm font-semibold ${wizard.taxIncluded ? 'bg-blue-500 text-white' : ''}`} onClick={() => patch({ taxIncluded: true })}>Incl. Imposto</button>
                  </div>
                </div>

                <Input label="Taxa de Imposto (%) - IVA/Simples" inputMode="decimal" value={wizard.taxRatePct} onChange={(e) => patch({ taxRatePct: e.target.value })} />

                <div>
                  <div className="flex items-center justify-between">
                    <p className="label !mb-0">Taxas (comissao de marketplace, maquininha...)</p>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {FEE_PRESETS.map((p) => (
                      <button key={p.name} className="badge-gray !px-2 !py-1 !text-[11px]" onClick={() => addFee(p)}>+ {p.name}</button>
                    ))}
                    <button className="badge-gray !px-2 !py-1 !text-[11px]" onClick={() => addFee()}>+ Personalizada</button>
                  </div>
                  {wizard.fees.map((f, i) => (
                    <div key={f.id} className="mt-2 flex items-center gap-2">
                      <input className="input flex-1" placeholder="Nome da taxa" value={f.label} onChange={(e) => updateFee(i, { label: e.target.value })} />
                      <select className="input w-24" value={f.type} onChange={(e) => updateFee(i, { type: e.target.value })}>
                        <option value="pct">%</option>
                        <option value="fixed">R$</option>
                      </select>
                      <input className="input w-24" inputMode="decimal" value={f.value} onChange={(e) => updateFee(i, { value: e.target.value })} />
                      <button className="btn-icon" onClick={() => removeFee(i)}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-slate-200 p-3.5 dark:border-slate-700">
                  <Row label="Custo Total de Aquisicao" value={money(pricing.cost)} />
                  <Row label="Preco de Venda" value={money(pricing.priceExclTax)} />
                  <Row label="Lucro" value={money(pricing.profit)} highlight="green" />
                  {pricing.tax > 0 && <Row label={`Imposto (${wizard.taxRatePct}%)`} value={money(pricing.tax)} />}
                  {pricing.feesTotal > 0 && <Row label="Taxas" value={money(pricing.feesTotal)} />}
                  <div className="mt-1.5 flex justify-between border-t border-slate-200 pt-1.5 text-base font-bold dark:border-slate-700">
                    <span>Preco Final</span>
                    <span className="text-blue-500">{money(pricing.finalPrice)}</span>
                  </div>
                  {wizard.qty > 1 && (
                    <p className="mt-1 text-right text-xs text-slate-400">Total da venda ({wizard.qty} un.): <b>{money(pricing.finalPrice * wizard.qty)}</b></p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Excluir venda"
        message={`Excluir a venda de ${confirm?.qty}x ${confirm?.productName}? A quantidade volta para o estoque do produto.`}
        onConfirm={async () => {
          await removeSale(api, confirm);
          toast('Venda excluida e estoque devolvido.');
        }}
      />
    </div>
  );
}

function Row({ label, value, muted, highlight }) {
  return (
    <div className={`flex justify-between py-1 text-sm ${muted ? 'text-slate-400' : 'text-slate-600 dark:text-slate-300'}`}>
      <span>{label}</span>
      <span className={highlight === 'green' ? 'font-semibold text-green-500' : 'font-medium'}>{value}</span>
    </div>
  );
}

function MoneyRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <input className="input w-28 text-right" inputMode="decimal" placeholder="0,00" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function TierCard({ tier, selected, taxRatePct, onClick }) {
  const tones = {
    green: 'from-green-600 to-green-500',
    blue: 'from-blue-600 to-blue-500',
    orange: 'from-orange-600 to-orange-500',
    purple: 'from-purple-600 to-purple-500',
  };
  const withTax = tier.salePrice * (1 + (toNum(taxRatePct) || 0) / 100);
  return (
    <button
      onClick={onClick}
      className={`relative rounded-xl bg-gradient-to-br p-3.5 text-left text-white shadow-sm ${tones[tier.tone]} ${
        selected ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'opacity-90'
      }`}
    >
      {selected && (
        <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/90">
          <Check size={13} className="text-slate-900" />
        </span>
      )}
      <p className="font-bold">{tier.label}</p>
      <p className="text-xs text-white/80">{tier.marginPct}% margem de lucro</p>
      <div className="mt-2 space-y-0.5 text-xs">
        <p>Preco de Venda: <b>{money(tier.salePrice)}</b></p>
        <p>com imposto: <b>{money(withTax)}</b></p>
        <p>Lucro: <b>{money(tier.profit)}</b></p>
      </div>
    </button>
  );
}
