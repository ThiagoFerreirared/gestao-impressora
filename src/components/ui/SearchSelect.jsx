import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

// Seletor com busca (typeahead) — usado para escolher bobina, cliente, projeto.
// options: [{ value, label, sublabel?, render? }]
export default function SearchSelect({ label, value, onChange, options = [], placeholder = 'Selecionar...', allowClear = true }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || (o.sublabel || '').toLowerCase().includes(q)
    );
  }, [options, query]);

  return (
    <div ref={ref} className="relative">
      {label && <label className="label">{label}</label>}
      <button
        type="button"
        className="input flex items-center justify-between gap-2 text-left"
        onClick={() => {
          setOpen((o) => !o);
          setQuery('');
        }}
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-2">
            {selected.render}
            <span className="truncate">{selected.label}</span>
          </span>
        ) : (
          <span className="text-slate-400">{placeholder}</span>
        )}
        <span className="flex shrink-0 items-center gap-1">
          {allowClear && value && (
            <X
              size={14}
              className="text-slate-400 hover:text-red-500"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
            />
          )}
          <ChevronDown size={15} className="text-slate-400" />
        </span>
      </button>

      {open && (
        <div className="card absolute z-30 mt-1 max-h-64 w-full overflow-auto shadow-xl">
          <div className="sticky top-0 border-b border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
            <input
              autoFocus
              className="input"
              placeholder="Buscar..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {filtered.length === 0 && (
            <p className="px-3 py-3 text-sm text-slate-400">Nenhum resultado.</p>
          )}
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${
                o.value === value ? 'bg-blue-50 dark:bg-blue-500/10' : ''
              }`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.render}
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-800 dark:text-slate-200">
                  {o.label}
                </span>
                {o.sublabel && (
                  <span className="block truncate text-xs text-slate-400">{o.sublabel}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
