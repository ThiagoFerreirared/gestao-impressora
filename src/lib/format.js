const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const num2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num3 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export const money = (v) => brl.format(Number(v) || 0);
export const grams = (v) => `${num.format(Number(v) || 0)} g`;
export const kg = (v) => `${num2.format((Number(v) || 0) / 1000)} kg`;
export const perGram = (v) => `${brl.format(Number(v) || 0)}/g`;
export const fixed2 = (v) => num2.format(Number(v) || 0);
export const fixed3 = (v) => num3.format(Number(v) || 0);
export const pct = (v) => `${num.format(Number(v) || 0)}%`;

// Converte string de input ("12,5" ou "12.5") em número
export const toNum = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(/\./g, (m, i, s) => (s.includes(',') ? '' : m)).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

// Minutos -> "12h 30min"
export const hoursLabel = (minutes) => {
  const m = Math.round(Number(minutes) || 0);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}min`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}min`;
};

// "12:30" ou "12h30" ou "750" (min) -> minutos
export const parseDuration = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const s = String(v).trim().toLowerCase().replace('min', '').replace('m', '');
  if (s.includes(':') || s.includes('h')) {
    const [h, m] = s.split(/[:h]/);
    return (toNum(h) || 0) * 60 + (toNum(m) || 0);
  }
  return toNum(s);
};

// Minutos -> "hh:mm" para inputs
export const durationInput = (minutes) => {
  const m = Math.round(Number(minutes) || 0);
  if (!m) return '';
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};

export const dateBR = (v) => {
  if (!v) return '—';
  const d = toDate(v);
  if (!d) return '—';
  return d.toLocaleDateString('pt-BR');
};

export const dateTimeBR = (v) => {
  const d = toDate(v);
  if (!d) return '—';
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

// Aceita Timestamp do Firestore, Date, ISO string ou "yyyy-mm-dd"
export const toDate = (v) => {
  if (!v) return null;
  if (v.toDate) return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === 'string') {
    // "yyyy-mm-dd" deve ser interpretado em hora local, não UTC
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const [y, m, d] = v.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'number') return new Date(v);
  return null;
};

// Date -> "yyyy-mm-dd" para inputs type=date
export const dateInput = (v) => {
  const d = toDate(v);
  if (!d) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

export const todayInput = () => dateInput(new Date());

export const monthKey = (v) => {
  const d = toDate(v);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const monthLabel = (key) => {
  if (!key) return '';
  const [y, m] = key.split('-');
  const names = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${names[Number(m) - 1]}/${String(y).slice(2)}`;
};

export const lastMonths = (n = 6) => {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(monthKey(d));
  }
  return out;
};

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const orderNumber = (count) =>
  `PED-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
