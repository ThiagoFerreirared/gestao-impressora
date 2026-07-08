import { increment, serverTimestamp } from 'firebase/firestore';
import { logActivity } from './db';
import { costPerGram, failureCost } from './calculations';
import { uid as genId } from './format';

// Datas dentro de arrays/objetos embutidos são gravadas como ISO string
// (serverTimestamp não é permitido dentro de arrays no Firestore).
const nowIso = () => new Date().toISOString();

// Remove undefined (Firestore rejeita) — datas embutidas já são strings ISO
export const clean = (obj) => JSON.parse(JSON.stringify(obj ?? null));

const replacePart = (parts, partId, patch) =>
  (parts || []).map((p) => (p.id === partId ? { ...p, ...patch } : p));

// ──────────────────────────────────────────────────────────────
// PRODUÇÃO
// ──────────────────────────────────────────────────────────────

// Inicia a impressão de uma parte: registra início, tentativa e impressora
export const startPart = async (api, project, part, printerId) => {
  const parts = replacePart(project.parts, part.id, {
    prodStatus: 'imprimindo',
    printerId: printerId || part.printerId || '',
    startedAt: nowIso(),
    attempts: (Number(part.attempts) || 0) + 1,
  });
  await api.update(
    'projects',
    project.id,
    { parts: clean(parts), status: 'imprimindo' },
    `${project.name} — iniciou impressão de "${part.name}"`
  );
};

// Move uma parte na fila (pendente → fatiar → pronto → ... )
export const setPartStatus = async (api, project, part, prodStatus) => {
  const parts = replacePart(project.parts, part.id, { prodStatus });
  await api.update('projects', project.id, { parts: clean(parts) }, `${project.name} — "${part.name}"`);
};

// Conclui a impressão de uma parte:
//  • desconta gramas (peça + purga) de cada bobina usada nos slots do AMS
//  • grava histórico de uso em cada bobina
//  • soma horas de uso na impressora
//  • registra tempo real e conclui a parte
//  • se todas as partes terminaram, avança o status do projeto
export const completePart = async (api, { project, part, realMinutes, spoolsById, printersById }) => {
  const batch = api.batch();
  const finishedAt = nowIso();

  let consumedCost = 0;
  if (!part.consumed) {
    for (const slot of part.slots || []) {
      const spool = spoolsById[slot.spoolId];
      if (!spool) continue;
      const grams = (Number(slot.gramsPiece) || 0) + (Number(slot.gramsPurge) || 0);
      if (grams <= 0) continue;
      const cost = grams * costPerGram(spool);
      consumedCost += cost;
      const remainingAfter = Math.max(0, (Number(spool.currentWeight) || 0) - grams);
      const entry = {
        id: genId(),
        date: finishedAt,
        type: 'uso',
        projectId: project.id,
        projectName: project.name,
        partName: part.name,
        grams,
        cost,
        remainingAfter,
      };
      batch.update(api.ref('spools', spool.id), {
        currentWeight: remainingAfter,
        usageHistory: clean([...(spool.usageHistory || []), entry]),
        updatedAt: serverTimestamp(),
      });
    }
  }

  const parts = replacePart(project.parts, part.id, {
    prodStatus: 'concluido',
    realMinutes: Number(realMinutes) || 0,
    finishedAt,
    consumed: true,
  });

  const allDone = parts.every((p) => p.prodStatus === 'concluido');
  const hasPost = (project.postSteps || []).length > 0;
  const projectPatch = { parts: clean(parts), updatedAt: serverTimestamp() };
  if (allDone) {
    projectPatch.status = hasPost ? 'pos_processo' : 'concluido';
    if (!hasPost) projectPatch.completedAt = serverTimestamp();
  }
  batch.update(api.ref('projects', project.id), projectPatch);

  const printer = printersById[part.printerId];
  if (printer && realMinutes > 0) {
    batch.update(api.ref('printers', printer.id), {
      hoursUsed: increment(Number(realMinutes) / 60),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
  logActivity(api.uid, 'concluiu impressão', 'projects', `${project.name} — "${part.name}"`,
    `${Math.round(realMinutes)} min, custo de filamento R$ ${consumedCost.toFixed(2)}`);
};

// Registra falha de impressão:
//  • desconta filamento perdido por slot
//  • calcula o custo da falha (material + energia + hora máquina do tempo perdido)
//  • soma horas perdidas na impressora
//  • marca para reimpressão (volta para "pronto") ou mantém parada
export const registerFailure = async (
  api,
  { project, part, data, spoolsById, printersById, settings }
) => {
  const printer = printersById[part.printerId];
  const lostPerSlot = (data.lostPerSlot || []).filter((l) => (Number(l.grams) || 0) > 0);
  const cost = failureCost({
    lostPerSlot,
    lostMinutes: data.lostMinutes,
    printer,
    settings,
    spoolsById,
  });

  const batch = api.batch();
  const date = nowIso();

  for (const item of lostPerSlot) {
    const spool = spoolsById[item.spoolId];
    if (!spool) continue;
    const grams = Number(item.grams) || 0;
    const itemCost = grams * costPerGram(spool);
    const remainingAfter = Math.max(0, (Number(spool.currentWeight) || 0) - grams);
    const entry = {
      id: genId(),
      date,
      type: 'falha',
      projectId: project.id,
      projectName: project.name,
      partName: part.name,
      grams,
      cost: itemCost,
      remainingAfter,
    };
    batch.update(api.ref('spools', spool.id), {
      currentWeight: remainingAfter,
      usageHistory: clean([...(spool.usageHistory || []), entry]),
      updatedAt: serverTimestamp(),
    });
  }

  const failure = {
    id: genId(),
    date,
    partId: part.id,
    partName: part.name,
    printerId: part.printerId || '',
    reason: data.reason || 'Outro',
    reasonNote: data.reasonNote || '',
    lostMinutes: Number(data.lostMinutes) || 0,
    lostPerSlot: clean(lostPerSlot),
    cost: cost.total,
    reprint: !!data.reprint,
  };

  const parts = replacePart(project.parts, part.id, {
    prodStatus: data.reprint ? 'pronto' : 'pendente',
    startedAt: null,
  });

  batch.update(api.ref('projects', project.id), {
    parts: clean(parts),
    failures: clean([...(project.failures || []), failure]),
    status: data.reprint ? 'fila' : data.markProjectFailed ? 'falhou' : project.status,
    updatedAt: serverTimestamp(),
  });

  if (printer && failure.lostMinutes > 0) {
    batch.update(api.ref('printers', printer.id), {
      hoursUsed: increment(failure.lostMinutes / 60),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
  logActivity(api.uid, 'registrou falha', 'projects', `${project.name} — "${part.name}"`,
    `${failure.reason}, custo R$ ${cost.total.toFixed(2)}`);
};

// ──────────────────────────────────────────────────────────────
// ESTOQUE
// ──────────────────────────────────────────────────────────────

// Cadastra bobina e lança a despesa de filamento no Financeiro
export const addSpoolWithExpense = async (api, data) => {
  const label = `${data.material} ${data.colorName} (${data.brand})`;
  await api.add('spools', { ...data, usageHistory: [], restocks: [] }, label);
  if ((Number(data.price) || 0) > 0) {
    await api.add(
      'transactions',
      {
        type: 'despesa',
        category: 'filamento',
        description: `Compra de bobina — ${label}`,
        value: Number(data.price),
        date: data.purchaseDate || new Date().toISOString().slice(0, 10),
        auto: true,
      },
      `Despesa: bobina ${label}`
    );
  }
};

// Registra reposição da bobina (histórico) e zera o alerta de "pedido feito"
export const restockSpool = async (api, spool, { date, grams, price, supplier, logExpense }) => {
  const entry = { id: genId(), date, grams: Number(grams) || 0, price: Number(price) || 0, supplier: supplier || '' };
  await api.update(
    'spools',
    spool.id,
    {
      restocks: clean([...(spool.restocks || []), entry]),
      currentWeight: (Number(spool.currentWeight) || 0) + entry.grams,
      reorderPlaced: false,
    },
    `Reposição — ${spool.material} ${spool.colorName}`
  );
  if (logExpense && entry.price > 0) {
    await api.add(
      'transactions',
      {
        type: 'despesa',
        category: 'filamento',
        description: `Reposição de bobina — ${spool.material} ${spool.colorName}`,
        value: entry.price,
        date,
        auto: true,
      },
      `Despesa: reposição ${spool.material} ${spool.colorName}`
    );
  }
};

// Ajuste manual de peso (ex: pesou a bobina na balança)
export const adjustSpoolWeight = async (api, spool, newWeight, note) => {
  const entry = {
    id: genId(),
    date: nowIso(),
    type: 'ajuste',
    projectId: '',
    projectName: note || 'Ajuste manual',
    partName: '',
    grams: (Number(spool.currentWeight) || 0) - (Number(newWeight) || 0),
    cost: 0,
    remainingAfter: Number(newWeight) || 0,
  };
  await api.update(
    'spools',
    spool.id,
    {
      currentWeight: Number(newWeight) || 0,
      usageHistory: clean([...(spool.usageHistory || []), entry]),
    },
    `Ajuste de peso — ${spool.material} ${spool.colorName}`
  );
};

// ──────────────────────────────────────────────────────────────
// PEDIDOS / FINANCEIRO
// ──────────────────────────────────────────────────────────────

export const orderTotal = (order) => {
  const items = (order.items || []).reduce(
    (a, i) => a + (Number(i.qty) || 1) * (Number(i.unitPrice) || 0),
    0
  );
  return Math.max(0, items - (Number(order.discount) || 0));
};

// Marca pedido como pago e lança a receita no Financeiro (uma única vez)
export const markOrderPaid = async (api, order, clientName) => {
  await api.update('orders', order.id, { paymentStatus: 'pago' }, `Pedido ${order.number} pago`);
  if (!order.revenueLogged) {
    await api.add(
      'transactions',
      {
        type: 'receita',
        category: 'venda',
        description: `Pedido ${order.number}${clientName ? ` — ${clientName}` : ''}`,
        value: orderTotal(order),
        date: new Date().toISOString().slice(0, 10),
        orderId: order.id,
        auto: true,
      },
      `Receita: pedido ${order.number}`
    );
    await api.update('orders', order.id, { revenueLogged: true }, `Pedido ${order.number}`);
  }
};

// ──────────────────────────────────────────────────────────────
// MANUTENÇÃO
// ──────────────────────────────────────────────────────────────

// Registra manutenção realizada, atualiza a agenda da impressora
// e lança a despesa (se houver custo)
export const addMaintenanceRecord = async (api, printer, data) => {
  await api.add('maintenanceRecords', data, `${data.type} — ${printer?.name || ''}`);

  if (printer) {
    const schedules = (printer.schedules || []).map((s) =>
      s.type === data.type
        ? { ...s, lastDoneHours: Number(data.hoursAtMaintenance) || Number(printer.hoursUsed) || 0, lastDoneDate: data.date }
        : s
    );
    await api.update('printers', printer.id, { schedules: clean(schedules) }, printer.name);
  }

  if ((Number(data.cost) || 0) > 0) {
    await api.add(
      'transactions',
      {
        type: 'despesa',
        category: 'manutencao',
        description: `Manutenção — ${data.type}${printer ? ` (${printer.name})` : ''}`,
        value: Number(data.cost),
        date: data.date,
        printerId: printer?.id || '',
        auto: true,
      },
      `Despesa: manutenção ${data.type}`
    );
  }
};

// ──────────────────────────────────────────────────────────────
// PROJETOS
// ──────────────────────────────────────────────────────────────

const resetParts = (parts) =>
  (parts || []).map((p) => ({
    ...p,
    id: genId(),
    prodStatus: 'pendente',
    attempts: 0,
    startedAt: null,
    finishedAt: null,
    realMinutes: 0,
    consumed: false,
  }));

export const duplicateProject = async (api, project) => {
  const copy = {
    ...clean(project),
    name: `${project.name} (cópia)`,
    status: 'orcamento',
    parts: resetParts(project.parts),
    failures: [],
    quality: '',
    completedAt: null,
    budget: {
      ...clean(project.budget || {}),
      priceHistory: [],
      estimateSnapshot: null,
    },
    postSteps: (project.postSteps || []).map((s) => ({ ...clean(s), done: false })),
  };
  delete copy.id;
  delete copy.createdAt;
  delete copy.updatedAt;
  return api.add('projects', copy, copy.name);
};

export const saveAsTemplate = async (api, project) => {
  const data = {
    ...clean(project),
    parts: resetParts(project.parts),
    failures: [],
    quality: '',
    completedAt: null,
    status: 'orcamento',
  };
  delete data.id;
  delete data.createdAt;
  delete data.updatedAt;
  await api.add('templates', { name: project.name, data }, `Template: ${project.name}`);
};

export const projectFromTemplate = async (api, template) => {
  const data = {
    ...clean(template.data || {}),
    name: template.name,
    status: 'orcamento',
    parts: resetParts(template.data?.parts),
    failures: [],
  };
  return api.add('projects', data, data.name);
};

// ──────────────────────────────────────────────────────────────
// PRODUTOS (catálogo em lote) / VENDAS
// ──────────────────────────────────────────────────────────────

// Produz um lote: soma `qty` unidades ao estoque do produto e desconta o
// filamento correspondente (qty × gramas de cada slot da receita) das bobinas —
// mesma lógica de "concluir impressão" dos Projetos, só que sem parte/slot individual.
export const produceStock = async (api, product, { qty, spoolsById = {} }) => {
  const units = Number(qty) || 0;
  if (units <= 0) throw new Error('Quantidade produzida deve ser maior que zero.');

  const batch = api.batch();
  const date = new Date().toISOString();
  let filamentCost = 0;

  for (const slot of product.slots || []) {
    const spool = spoolsById[slot.spoolId];
    if (!spool) continue;
    const grams = (Number(slot.grams) || 0) * units;
    if (grams <= 0) continue;
    const cost = grams * costPerGram(spool);
    filamentCost += cost;
    const remainingAfter = Math.max(0, (Number(spool.currentWeight) || 0) - grams);
    const entry = {
      id: genId(),
      date,
      type: 'uso',
      projectId: '',
      projectName: `Produto: ${product.name}`,
      partName: `Lote de ${units} un.`,
      grams,
      cost,
      remainingAfter,
    };
    batch.update(api.ref('spools', spool.id), {
      currentWeight: remainingAfter,
      usageHistory: clean([...(spool.usageHistory || []), entry]),
      updatedAt: serverTimestamp(),
    });
  }

  const production = {
    id: genId(),
    date,
    qty: units,
    filamentCost,
  };
  batch.update(api.ref('products', product.id), {
    stockQty: (Number(product.stockQty) || 0) + units,
    productionHistory: clean([...(product.productionHistory || []), production]),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  logActivity(api.uid, 'produziu lote', 'products', product.name, `+${units} un. · filamento ${filamentCost.toFixed(2)}`);
};

// Ajuste manual do estoque (contagem, perda, quebra) — NÃO mexe em filamento,
// pois não representa produção nova, só correção da contagem.
export const adjustProductStock = async (api, product, newQty, note) => {
  const qty = Math.max(0, Number(newQty) || 0);
  const delta = qty - (Number(product.stockQty) || 0);
  const entry = { id: genId(), date: new Date().toISOString(), delta, qtyAfter: qty, note: note || 'Ajuste manual' };
  await api.update(
    'products',
    product.id,
    {
      stockQty: qty,
      stockAdjustments: clean([...(product.stockAdjustments || []), entry]),
    },
    `Ajuste de estoque — ${product.name}`
  );
};

export const saleTotal = (sale) => (Number(sale?.pricing?.finalPrice) || 0) * (Number(sale?.qty) || 1);

// Registra uma venda de produto: desconta do estoque, salva o snapshot completo
// de custo/preço usado (histórico não muda se o produto mudar depois) e lança
// a receita no Financeiro — tudo em uma operação atômica.
export const registerSale = async (api, { product, clientId, clientName, qty, saleDate, costs, pricing, notes }) => {
  const units = Number(qty) || 1;
  if (units > (Number(product.stockQty) || 0)) {
    throw new Error('Quantidade maior que o estoque disponível.');
  }

  const batch = api.batch();
  const saleRef = api.ref('productSales', genId());
  const total = (Number(pricing?.finalPrice) || 0) * units;

  batch.set(saleRef, {
    productId: product.id,
    productName: product.name,
    clientId: clientId || '',
    clientName: clientName || '',
    qty: units,
    saleDate: saleDate || new Date().toISOString().slice(0, 10),
    costs: clean(costs),
    pricing: clean(pricing),
    total,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.update(api.ref('products', product.id), {
    stockQty: (Number(product.stockQty) || 0) - units,
    updatedAt: serverTimestamp(),
  });

  const txRef = api.ref('transactions', genId());
  batch.set(txRef, {
    type: 'receita',
    category: 'venda',
    description: `Venda — ${units}× ${product.name}${clientName ? ` (${clientName})` : ''}`,
    value: total,
    date: saleDate || new Date().toISOString().slice(0, 10),
    productSaleId: saleRef.id,
    auto: true,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
  logActivity(api.uid, 'registrou venda', 'productSales', `${units}× ${product.name}`, `${clientName || 'sem cliente'} — R$ ${total.toFixed(2)}`);
};

export const removeSale = async (api, sale) => {
  const product = sale._product;
  const batch = api.batch();
  batch.delete(api.ref('productSales', sale.id));
  if (product) {
    batch.update(api.ref('products', product.id), {
      stockQty: (Number(product.stockQty) || 0) + (Number(sale.qty) || 1),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
  logActivity(api.uid, 'excluiu venda', 'productSales', `${sale.qty}× ${sale.productName}`, 'estoque devolvido');
};
