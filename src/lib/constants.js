// ─── Materiais pré-cadastrados (semeados no primeiro login, editáveis na Biblioteca) ───
export const DEFAULT_MATERIALS = [
  { name: 'PLA Basic', nozzleMin: 190, nozzleMax: 220, bedMin: 50, bedMax: 60, speedMax: 300, traits: 'Fácil de imprimir, ideal para peças decorativas e protótipos.' },
  { name: 'PLA Matte', nozzleMin: 190, nozzleMax: 220, bedMin: 50, bedMax: 60, speedMax: 250, traits: 'Acabamento fosco que esconde camadas. Levemente mais frágil.' },
  { name: 'PLA Silk', nozzleMin: 200, nozzleMax: 230, bedMin: 50, bedMax: 60, speedMax: 150, traits: 'Brilho sedoso. Imprimir mais devagar para melhor acabamento.' },
  { name: 'PLA High Speed', nozzleMin: 200, nozzleMax: 230, bedMin: 50, bedMax: 60, speedMax: 500, traits: 'Formulado para altas velocidades (A1/X1/P1).' },
  { name: 'PLA+', nozzleMin: 200, nozzleMax: 230, bedMin: 50, bedMax: 65, speedMax: 300, traits: 'Mais resistente que PLA comum.' },
  { name: 'PETG Basic', nozzleMin: 230, nozzleMax: 260, bedMin: 70, bedMax: 80, speedMax: 200, traits: 'Resistente e levemente flexível. Cuidado com fiapos (stringing).' },
  { name: 'PETG HF', nozzleMin: 230, nozzleMax: 260, bedMin: 70, bedMax: 80, speedMax: 300, traits: 'PETG High Flow para impressão rápida.' },
  { name: 'ABS', nozzleMin: 240, nozzleMax: 270, bedMin: 90, bedMax: 100, speedMax: 200, traits: 'Resistente ao calor. Exige ambiente fechado; libera odor.' },
  { name: 'ASA', nozzleMin: 240, nozzleMax: 270, bedMin: 90, bedMax: 100, speedMax: 200, traits: 'Resistente a UV, ideal para peças externas.' },
  { name: 'TPU 95A', nozzleMin: 220, nozzleMax: 240, bedMin: 30, bedMax: 50, speedMax: 60, traits: 'Flexível. Imprimir devagar; AMS não recomendado para TPU.' },
  { name: 'TPU 64D', nozzleMin: 220, nozzleMax: 245, bedMin: 30, bedMax: 50, speedMax: 100, traits: 'TPU mais rígido, melhor de imprimir que 95A.' },
  { name: 'HIPS', nozzleMin: 230, nozzleMax: 250, bedMin: 90, bedMax: 100, speedMax: 150, traits: 'Leve. Usado como suporte solúvel para ABS (limoneno).' },
  { name: 'Nylon PA6', nozzleMin: 260, nozzleMax: 290, bedMin: 80, bedMax: 100, speedMax: 120, traits: 'Muito resistente. Higroscópico: secar antes de usar.' },
  { name: 'Nylon PA12', nozzleMin: 250, nozzleMax: 280, bedMin: 80, bedMax: 100, speedMax: 120, traits: 'Absorve menos umidade que PA6.' },
  { name: 'PC (Policarbonato)', nozzleMin: 260, nozzleMax: 300, bedMin: 90, bedMax: 110, speedMax: 100, traits: 'Altíssima resistência mecânica e térmica.' },
  { name: 'PVA', nozzleMin: 190, nozzleMax: 220, bedMin: 50, bedMax: 60, speedMax: 80, traits: 'Suporte solúvel em água. Manter sempre seco.' },
  { name: 'BVOH', nozzleMin: 190, nozzleMax: 220, bedMin: 50, bedMax: 60, speedMax: 80, traits: 'Suporte solúvel, dissolve mais rápido que PVA.' },
  { name: 'PLA-CF', nozzleMin: 200, nozzleMax: 230, bedMin: 50, bedMax: 60, speedMax: 200, traits: 'PLA com fibra de carbono. Exige bico endurecido (0.4 aço).' },
  { name: 'PETG-CF', nozzleMin: 240, nozzleMax: 270, bedMin: 70, bedMax: 80, speedMax: 150, traits: 'PETG com fibra de carbono. Exige bico endurecido.' },
  { name: 'PA-CF', nozzleMin: 260, nozzleMax: 300, bedMin: 80, bedMax: 100, speedMax: 120, traits: 'Nylon com fibra de carbono, uso técnico. Bico endurecido.' },
];

export const DEFAULT_BRANDS = [
  'Bambu Lab',
  'Polymaker',
  'Esun',
  'Elegoo',
  'Hatchbox',
  'Voolt3D',
  'Creality',
  'Sunlu',
  '3D Fila',
  'GTMax3D',
];

export const FINISHES = [
  'Basic',
  'Matte',
  'Silk',
  'Transparente',
  'Marble',
  'Galaxy',
  'Wood',
  'Metal',
  'Fluorescente',
  'Fosco',
  'Glitter',
  'Personalizado',
];

export const DIAMETERS = ['1.75', '2.85'];

export const SPOOL_WEIGHTS = [1000, 750, 500, 250];

// ─── Status de bobina (calculado, não gravado) ───
export const SPOOL_STATUS = {
  disponivel: { label: 'Disponível', badge: 'badge-green' },
  em_uso: { label: 'Em uso', badge: 'badge-blue' },
  acabando: { label: 'Acabando', badge: 'badge-yellow' },
  esgotada: { label: 'Esgotada', badge: 'badge-red' },
};

// ─── Projetos ───
export const PROJECT_CATEGORIES = [
  'Action figure',
  'Peça técnica',
  'Decoração',
  'Reposição',
  'Teste',
  'Calibração',
  'Kit',
  'Personalizado',
];

export const PRIORITIES = {
  baixa: { label: 'Baixa', badge: 'badge-gray', order: 3 },
  normal: { label: 'Normal', badge: 'badge-blue', order: 2 },
  alta: { label: 'Alta', badge: 'badge-yellow', order: 1 },
  urgente: { label: 'Urgente', badge: 'badge-red', order: 0 },
};

export const PROJECT_STATUS = {
  orcamento: { label: 'Orçamento', badge: 'badge-gray' },
  aguardando_aprovacao: { label: 'Aguardando aprovação', badge: 'badge-purple' },
  fila: { label: 'Na fila', badge: 'badge-cyan' },
  fatiando: { label: 'Fatiando', badge: 'badge-blue' },
  imprimindo: { label: 'Imprimindo', badge: 'badge-blue' },
  pos_processo: { label: 'Pós-processo', badge: 'badge-purple' },
  concluido: { label: 'Concluído', badge: 'badge-green' },
  entregue: { label: 'Entregue', badge: 'badge-green' },
  cancelado: { label: 'Cancelado', badge: 'badge-gray' },
  falhou: { label: 'Falhou', badge: 'badge-red' },
};

export const PROJECT_STATUS_FLOW = [
  'orcamento',
  'aguardando_aprovacao',
  'fila',
  'fatiando',
  'imprimindo',
  'pos_processo',
  'concluido',
  'entregue',
  'cancelado',
  'falhou',
];

// Status de projeto que contam como "ativos/futuros" para alocação de bobina
export const ACTIVE_PROJECT_STATUSES = [
  'aguardando_aprovacao',
  'fila',
  'fatiando',
  'imprimindo',
  'pos_processo',
];

// ─── Produção (status por parte) ───
export const PART_STATUS = {
  pendente: { label: 'Pendente', badge: 'badge-gray' },
  fatiar: { label: 'Pronto p/ fatiar', badge: 'badge-purple' },
  pronto: { label: 'Pronto p/ imprimir', badge: 'badge-cyan' },
  imprimindo: { label: 'Imprimindo', badge: 'badge-blue' },
  pos: { label: 'Pós-processando', badge: 'badge-yellow' },
  concluido: { label: 'Concluído', badge: 'badge-green' },
};

export const PART_STATUS_FLOW = ['pendente', 'fatiar', 'pronto', 'imprimindo', 'pos', 'concluido'];

export const FAILURE_REASONS = [
  'Descolou da mesa',
  'Entupimento do bico',
  'Spaghetti / perda de adesão',
  'Filamento embolou no AMS',
  'Filamento acabou',
  'Queda de energia',
  'Warping',
  'Camadas deslocadas (layer shift)',
  'Erro de fatiamento',
  'Suporte falhou',
  'Outro',
];

// ─── Pós-processamento ───
export const POST_STEPS = [
  'Remoção de suportes',
  'Lixamento',
  'Colagem',
  'Pintura',
  'Primer',
  'Verniz',
  'Montagem',
  'Embalagem',
];

export const QUALITY = {
  otima: { label: 'Ótima', badge: 'badge-green' },
  boa: { label: 'Boa', badge: 'badge-blue' },
  aceitavel: { label: 'Aceitável', badge: 'badge-yellow' },
  ruim: { label: 'Ruim', badge: 'badge-red' },
};

// ─── Pedidos ───
export const PAYMENT_METHODS = ['Pix', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', 'Transferência', 'Outro'];

export const PAYMENT_STATUS = {
  pendente: { label: 'Pendente', badge: 'badge-yellow' },
  parcial: { label: 'Parcial', badge: 'badge-blue' },
  pago: { label: 'Pago', badge: 'badge-green' },
};

export const ORDER_STATUS = {
  aberto: { label: 'Aberto', badge: 'badge-gray' },
  producao: { label: 'Em produção', badge: 'badge-blue' },
  pronto: { label: 'Pronto', badge: 'badge-cyan' },
  entregue: { label: 'Entregue', badge: 'badge-green' },
  cancelado: { label: 'Cancelado', badge: 'badge-red' },
};

// ─── Financeiro ───
export const EXPENSE_CATEGORIES = {
  filamento: 'Filamento',
  energia: 'Energia',
  manutencao: 'Manutenção',
  pecas_reposicao: 'Peças de reposição',
  embalagem: 'Embalagem',
  ferramentas: 'Ferramentas',
  outros: 'Outros',
};

export const REVENUE_CATEGORIES = {
  venda: 'Venda',
  outros: 'Outros',
};

// ─── Impressoras ───
export const PRINTER_STATUS = {
  ativa: { label: 'Ativa', badge: 'badge-green' },
  manutencao: { label: 'Manutenção', badge: 'badge-yellow' },
  parada: { label: 'Parada', badge: 'badge-red' },
};

// Tipos de manutenção preventiva + intervalo padrão em horas de uso
export const MAINTENANCE_TYPES = [
  { type: 'Limpeza do bico', intervalHours: 200 },
  { type: 'Lubrificação dos trilhos', intervalHours: 300 },
  { type: 'Calibração', intervalHours: 150 },
  { type: 'Troca de nozzle', intervalHours: 1000 },
  { type: 'Inspeção do AMS', intervalHours: 500 },
  { type: 'Limpeza da placa de impressão', intervalHours: 50 },
];

// ─── Tags coloridas ───
export const TAG_COLORS = [
  { name: 'blue', class: 'badge-blue' },
  { name: 'green', class: 'badge-green' },
  { name: 'yellow', class: 'badge-yellow' },
  { name: 'red', class: 'badge-red' },
  { name: 'purple', class: 'badge-purple' },
  { name: 'cyan', class: 'badge-cyan' },
  { name: 'gray', class: 'badge-gray' },
];

// ─── Checklists padrão ───
export const DEFAULT_PRE_CHECKLIST = [
  'Placa de impressão limpa',
  'Filamento carregado nos slots corretos do AMS',
  'Cores conferidas com o fatiamento',
  'Calibração ok',
  'Arquivo correto enviado',
  'Sem restos de filamento no bico',
];

export const DEFAULT_POST_CHECKLIST = [
  'Peça removida com cuidado da placa',
  'Placa limpa para a próxima impressão',
  'Qualidade da peça verificada',
  'Horas e gramas reais registradas',
  'Suportes descartados / pesados como purga',
];

// ─── Configurações padrão ───
export const DEFAULT_SETTINGS = {
  businessName: 'Minha Operação 3D',
  energyTariff: 0.95, // R$/kWh
  printerWattsDefault: 400, // W (Bambu Lab A1: pico ~350-400W)
  margins: { sale: 50, resale: 35, wholesale: 25 }, // %
  laborRate: 25, // R$/hora
  lowStockDefault: 100, // g
  customMaterials: [],
  customBrands: [],
  preChecklist: DEFAULT_PRE_CHECKLIST,
  postChecklist: DEFAULT_POST_CHECKLIST,
  theme: 'dark',
};

export const AMS_SLOTS = [1, 2, 3, 4];
