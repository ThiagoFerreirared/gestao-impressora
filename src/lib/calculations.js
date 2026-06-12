import { ACTIVE_PROJECT_STATUSES } from './constants';

// ──────────────────────────────────────────────────────────────
// REGRAS DE NEGÓCIO — todos os cálculos de custo ficam aqui.
// ──────────────────────────────────────────────────────────────

// Custo por grama da bobina = preço pago ÷ peso original
export const costPerGram = (spool) => {
  if (!spool) return 0;
  const w = Number(spool.initialWeight) || 0;
  return w > 0 ? (Number(spool.price) || 0) / w : 0;
};

// Custo/hora da impressora = valor de compra ÷ vida útil estimada
export const printerCostPerHour = (printer) => {
  if (!printer) return 0;
  const life = Number(printer.lifespanHours) || 0;
  return life > 0 ? (Number(printer.purchasePrice) || 0) / life : 0;
};

// Custo de energia = horas × consumo (W) ÷ 1000 × tarifa (R$/kWh)
export const energyCost = (minutes, watts, tariff) =>
  ((Number(minutes) || 0) / 60) * ((Number(watts) || 0) / 1000) * (Number(tariff) || 0);

export const machineCost = (minutes, printer) =>
  ((Number(minutes) || 0) / 60) * printerCostPerHour(printer);

// ─── Bobinas ───

// Projetos ativos/futuros que usam a bobina (para alerta e status "em uso")
export const spoolAllocations = (spoolId, projects = []) => {
  const out = [];
  for (const p of projects) {
    if (!ACTIVE_PROJECT_STATUSES.includes(p.status)) continue;
    const used = (p.parts || []).some((part) =>
      (part.slots || []).some((s) => s.spoolId === spoolId)
    );
    if (used) out.push(p);
  }
  return out;
};

// Status calculado da bobina: esgotada > acabando > em_uso > disponivel
export const spoolStatus = (spool, projects = []) => {
  const remaining = Number(spool.currentWeight) || 0;
  const threshold = Number(spool.alertThreshold) || 0;
  const allocations = spoolAllocations(spool.id, projects);
  if (remaining <= 0) return { status: 'esgotada', allocations };
  if (remaining < threshold) return { status: 'acabando', allocations };
  if (allocations.length > 0) return { status: 'em_uso', allocations };
  return { status: 'disponivel', allocations };
};

// Alertas de estoque: bobinas acabando/esgotadas (sem pedido feito),
// com destaque para as alocadas em projetos futuros.
export const stockAlerts = (spools = [], projects = []) =>
  spools
    .map((s) => ({ spool: s, ...spoolStatus(s, projects) }))
    .filter((a) => (a.status === 'acabando' || a.status === 'esgotada') && !a.spool.reorderPlaced);

// ─── Filamento por parte/projeto ───

// Soma de gramas e custo dos slots de uma parte (peça e purga separadas)
export const partFilament = (part, spoolsById = {}) => {
  let gramsPiece = 0;
  let gramsPurge = 0;
  let costPiece = 0;
  let costPurge = 0;
  for (const slot of part?.slots || []) {
    const spool = spoolsById[slot.spoolId];
    const cg = costPerGram(spool);
    const gp = Number(slot.gramsPiece) || 0;
    const gw = Number(slot.gramsPurge) || 0;
    gramsPiece += gp;
    gramsPurge += gw;
    costPiece += gp * cg;
    costPurge += gw * cg;
  }
  return { gramsPiece, gramsPurge, costPiece, costPurge, gramsTotal: gramsPiece + gramsPurge, costTotal: costPiece + costPurge };
};

export const projectMinutes = (project, { real = false } = {}) =>
  (project?.parts || []).reduce(
    (acc, p) => acc + (Number(real ? p.realMinutes || p.estMinutes : p.estMinutes) || 0),
    0
  );

// Custo de pós-processamento (mão de obra das etapas usa a tarifa/hora + custo direto)
export const postProcessing = (project, settings) => {
  const steps = project?.postSteps || [];
  const minutes = steps.reduce((a, s) => a + (Number(s.minutes) || 0), 0);
  const direct = steps.reduce((a, s) => a + (Number(s.cost) || 0), 0);
  const labor = (minutes / 60) * (Number(settings?.laborRate) || 0);
  return { minutes, direct, labor, total: direct + labor };
};

// ─── Breakdown completo de custos do projeto ───
// real=false → estimado (tempos estimados, sem falhas)
// real=true  → real (tempos reais quando houver + custo das falhas)
export const projectCosts = (project, ctx, { real = false } = {}) => {
  const { spoolsById = {}, printersById = {}, settings = {} } = ctx || {};
  const budget = project?.budget || {};

  let filamentPiece = 0;
  let filamentPurge = 0;
  let energy = 0;
  let machine = 0;
  const perPart = [];

  for (const part of project?.parts || []) {
    const fil = partFilament(part, spoolsById);
    const minutes = Number(real ? part.realMinutes || part.estMinutes : part.estMinutes) || 0;
    const printer = printersById[part.printerId];
    const watts = Number(printer?.watts) || Number(settings.printerWattsDefault) || 0;
    const pEnergy = energyCost(minutes, watts, settings.energyTariff);
    const pMachine = machineCost(minutes, printer);
    filamentPiece += fil.costPiece;
    filamentPurge += fil.costPurge;
    energy += pEnergy;
    machine += pMachine;
    perPart.push({
      partId: part.id,
      name: part.name,
      minutes,
      ...fil,
      energy: pEnergy,
      machine: pMachine,
      total: fil.costTotal + pEnergy + pMachine,
    });
  }

  const labor =
    budget.laborMode === 'fixed'
      ? Number(budget.laborFixed) || 0
      : (Number(budget.laborHours) || 0) * (Number(settings.laborRate) || 0);

  const finishing = (budget.finishing || []).reduce((a, f) => a + (Number(f.value) || 0), 0);
  const packaging = Number(budget.packagingCost) || 0;
  const shipping = Number(budget.shippingCost) || 0;
  const post = postProcessing(project, settings);
  const failures = real
    ? (project?.failures || []).reduce((a, f) => a + (Number(f.cost) || 0), 0)
    : 0;

  const total =
    filamentPiece + filamentPurge + energy + machine + labor + finishing + packaging + shipping + post.total + failures;

  return {
    filamentPiece,
    filamentPurge,
    filament: filamentPiece + filamentPurge,
    energy,
    machine,
    labor,
    finishing,
    packaging,
    shipping,
    post: post.total,
    postMinutes: post.minutes,
    failures,
    total,
    perPart,
  };
};

// ─── Precificação ───

// Preço sugerido = custo ÷ (1 − margem%)  (markup sobre o preço de venda)
export const suggestedPrice = (cost, marginPct) => {
  const m = (Number(marginPct) || 0) / 100;
  if (m >= 1) return 0;
  return (Number(cost) || 0) / (1 - m);
};

export const projectPrices = (project, ctx) => {
  const costs = projectCosts(project, ctx, { real: false });
  const budget = project?.budget || {};
  const margins = budget.margins || ctx?.settings?.margins || { sale: 50, resale: 35, wholesale: 25 };
  const sale = suggestedPrice(costs.total, margins.sale);
  const resale = suggestedPrice(costs.total, margins.resale);
  const wholesale = suggestedPrice(costs.total, margins.wholesale);
  const manual = budget.manualPrice !== null && budget.manualPrice !== undefined && budget.manualPrice !== ''
    ? Number(budget.manualPrice)
    : null;
  const finalPrice = manual !== null ? manual : sale;
  const promo = budget.promoDiscount
    ? finalPrice * (1 - (Number(budget.promoDiscount) || 0) / 100)
    : null;
  return { costs, margins, sale, resale, wholesale, manual, finalPrice, promo };
};

// ─── Falhas ───

// Custo da falha = filamento perdido (custo/g de cada bobina) + tempo perdido (energia + máquina)
export const failureCost = ({ lostPerSlot = [], lostMinutes = 0, printer, settings, spoolsById = {} }) => {
  let filament = 0;
  for (const item of lostPerSlot) {
    const spool = spoolsById[item.spoolId];
    filament += (Number(item.grams) || 0) * costPerGram(spool);
  }
  const watts = Number(printer?.watts) || Number(settings?.printerWattsDefault) || 0;
  const energy = energyCost(lostMinutes, watts, settings?.energyTariff);
  const machine = machineCost(lostMinutes, printer);
  return { filament, energy, machine, total: filament + energy + machine };
};

// ─── Manutenção ───

// Situação de cada agenda de manutenção da impressora.
// Avisa quando faltam menos de 10% do intervalo (ou já passou).
export const maintenanceDue = (printer) => {
  const hours = Number(printer?.hoursUsed) || 0;
  return (printer?.schedules || []).map((s) => {
    const interval = Number(s.intervalHours) || 0;
    const since = hours - (Number(s.lastDoneHours) || 0);
    const remaining = interval - since;
    let level = 'ok';
    if (interval > 0 && remaining <= 0) level = 'overdue';
    else if (interval > 0 && remaining <= interval * 0.1) level = 'soon';
    return { ...s, since, remaining, level };
  });
};

export const maintenanceAlerts = (printers = []) => {
  const out = [];
  for (const p of printers) {
    for (const d of maintenanceDue(p)) {
      if (d.level !== 'ok') out.push({ printer: p, ...d });
    }
  }
  return out;
};

// ─── Métricas agregadas (Dashboard/Relatórios) ───

export const projectIsSellable = (p) => !p.isTest && !['cancelado'].includes(p.status);

export const piecesProduced = (projects = []) =>
  projects
    .filter((p) => ['concluido', 'entregue'].includes(p.status) && !p.isTest)
    .reduce(
      (acc, p) =>
        acc + (p.parts || []).reduce((a, part) => a + (Number(part.quantity) || 1), 0),
      0
    );

export const printStats = (projects = []) => {
  let completed = 0;
  let failed = 0;
  for (const p of projects) {
    for (const part of p.parts || []) {
      if (part.prodStatus === 'concluido') completed += 1;
    }
    failed += (p.failures || []).length;
  }
  return { completed, failed };
};

// Desperdício (purga + falhas) em gramas e R$, por período opcional
export const wasteStats = (projects = [], spoolsById = {}, { from = null, to = null } = {}) => {
  const inRange = (d) => {
    if (!d) return true;
    const t = d.toDate ? d.toDate() : new Date(d);
    if (from && t < from) return false;
    if (to && t > to) return false;
    return true;
  };
  let purgeGrams = 0;
  let purgeCost = 0;
  let failGrams = 0;
  let failCost = 0;
  for (const p of projects) {
    for (const part of p.parts || []) {
      if (part.prodStatus !== 'concluido' || !inRange(part.finishedAt)) continue;
      for (const slot of part.slots || []) {
        const g = Number(slot.gramsPurge) || 0;
        purgeGrams += g;
        purgeCost += g * costPerGram(spoolsById[slot.spoolId]);
      }
    }
    for (const f of p.failures || []) {
      if (!inRange(f.date)) continue;
      for (const item of f.lostPerSlot || []) {
        failGrams += Number(item.grams) || 0;
      }
      failCost += Number(f.cost) || 0;
    }
  }
  return { purgeGrams, purgeCost, failGrams, failCost, totalGrams: purgeGrams + failGrams, totalCost: purgeCost + failCost };
};
