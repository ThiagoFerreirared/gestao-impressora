import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { ColorDot } from '../ui/Badge';

// Busca global: projetos, clientes, bobinas, pedidos e impressoras
export default function GlobalSearch() {
  const { projects, clients, spools, orders, printers } = useData();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const match = (...fields) => fields.some((f) => String(f || '').toLowerCase().includes(q));
    const out = [];

    for (const p of projects) {
      if (match(p.name, p.description, ...(p.tags || []).map((t) => t.label)))
        out.push({ group: 'Projetos', label: p.name, to: `/projetos/${p.id}` });
    }
    for (const c of clients) {
      if (match(c.name, c.phone, c.email, c.instagram))
        out.push({ group: 'Clientes', label: c.name, to: '/clientes' });
    }
    for (const s of spools) {
      if (match(s.material, s.colorName, s.brand, s.location))
        out.push({
          group: 'Bobinas',
          label: `${s.material} ${s.colorName} (${s.brand})`,
          to: '/filamentos',
          render: <ColorDot hex={s.colorHex} />,
        });
    }
    for (const o of orders) {
      if (match(o.number)) out.push({ group: 'Pedidos', label: o.number, to: '/pedidos' });
    }
    for (const p of printers) {
      if (match(p.name, p.model)) out.push({ group: 'Impressoras', label: p.name, to: '/impressoras' });
    }
    return out.slice(0, 12);
  }, [query, projects, clients, spools, orders, printers]);

  const groups = useMemo(() => {
    const g = {};
    for (const r of results) (g[r.group] = g[r.group] || []).push(r);
    return g;
  }, [results]);

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        className="input pl-9"
        placeholder="Busca global (projetos, bobinas, clientes...)"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && query.trim().length >= 2 && (
        <div className="card absolute z-40 mt-1 max-h-80 w-full overflow-auto shadow-xl">
          {results.length === 0 && (
            <p className="px-3 py-3 text-sm text-slate-400">Nenhum resultado para "{query}".</p>
          )}
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <p className="bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:bg-slate-800/60">
                {group}
              </p>
              {items.map((r, i) => (
                <button
                  key={`${group}-${i}`}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={() => {
                    navigate(r.to);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  {r.render}
                  <span className="truncate">{r.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
