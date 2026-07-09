import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, Search } from 'lucide-react';
import EmptyState from './EmptyState';

// Tabela com busca, filtros e ordenação — usada em todas as listas do sistema.
// columns: [{ key, label, render?(row), sortValue?(row), className? }]
// filters: [{ key, label, options: [{value,label}], fn?(row, value) }]
// No celular (abaixo de sm) as linhas viram cartões: 1ª coluna = título,
// última coluna = destaque à direita (ex.: estoque, total), meio = lista label/valor.
export default function DataTable({
  data = [],
  columns = [],
  searchKeys = [],
  searchPlaceholder = 'Buscar...',
  filters = [],
  initialSort = null,
  onRowClick,
  rowActions,
  emptyTitle = 'Nada por aqui',
  emptyMessage,
  toolbar,
  getRowKey = (row) => row.id,
}) {
  const [search, setSearch] = useState('');
  const [filterValues, setFilterValues] = useState({});
  const [sort, setSort] = useState(initialSort); // {key, dir}

  const filtered = useMemo(() => {
    let rows = data;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((row) =>
        searchKeys.some((k) => {
          const v = typeof k === 'function' ? k(row) : row[k];
          return String(v ?? '').toLowerCase().includes(q);
        })
      );
    }

    for (const f of filters) {
      const v = filterValues[f.key];
      if (!v) continue;
      rows = rows.filter((row) => (f.fn ? f.fn(row, v) : String(row[f.key] ?? '') === v));
    }

    if (sort) {
      const colDef = columns.find((c) => c.key === sort.key);
      const getVal = colDef?.sortValue || ((row) => row[sort.key]);
      rows = [...rows].sort((a, b) => {
        const va = getVal(a);
        const vb = getVal(b);
        if (typeof va === 'number' && typeof vb === 'number') return sort.dir === 'asc' ? va - vb : vb - va;
        return sort.dir === 'asc'
          ? String(va ?? '').localeCompare(String(vb ?? ''))
          : String(vb ?? '').localeCompare(String(va ?? ''));
      });
    }

    return rows;
  }, [data, search, searchKeys, filters, filterValues, sort, columns]);

  const toggleSort = (key, sortable) => {
    if (!sortable) return;
    setSort((s) =>
      s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
        <div className="relative min-w-[180px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {filters.map((f) => (
          <select
            key={f.key}
            className="input w-auto"
            value={filterValues[f.key] || ''}
            onChange={(e) => setFilterValues((fv) => ({ ...fv, [f.key]: e.target.value }))}
          >
            <option value="">{f.label}</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ))}
        {toolbar}
        <span className="ml-auto whitespace-nowrap text-xs text-slate-400">
          {filtered.length} {filtered.length === 1 ? 'item' : 'itens'}
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={emptyTitle} message={emptyMessage} />
      ) : (
        <>
          {/* ───── Mobile: lista em cartões (estilo estoque) ───── */}
          <div className="max-h-[70vh] divide-y divide-slate-100 overflow-auto sm:hidden dark:divide-slate-800/70">
            {filtered.map((row) => {
              const titleCol = columns[0];
              const statCol = columns.length > 1 ? columns[columns.length - 1] : null;
              const midCols = columns.length > 2 ? columns.slice(1, -1) : [];
              return (
                <div
                  key={getRowKey(row)}
                  className={`flex flex-col gap-1.5 px-3.5 py-3 ${onRowClick ? 'cursor-pointer active:bg-slate-50 dark:active:bg-slate-800/60' : ''}`}
                  onClick={() => onRowClick?.(row)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {titleCol.render ? titleCol.render(row) : row[titleCol.key] ?? '—'}
                    </div>
                    {statCol && (
                      <div className="flex shrink-0 items-center gap-1 text-right">
                        {statCol.render ? statCol.render(row) : row[statCol.key] ?? '—'}
                        {onRowClick && <ChevronRight size={16} className="text-slate-300 dark:text-slate-600" />}
                      </div>
                    )}
                  </div>
                  {midCols.length > 0 && (
                    <div className="space-y-0.5">
                      {midCols.map((c) => (
                        <div key={c.key} className="flex items-start justify-between gap-2 text-xs">
                          <span className="shrink-0 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                            {c.label}
                          </span>
                          <span className="min-w-0 flex-1 text-right text-slate-600 dark:text-slate-300">
                            {c.render ? c.render(row) : row[c.key] ?? '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {rowActions && (
                    <div
                      className="mt-1 flex items-center justify-end gap-1 border-t border-slate-100 pt-1.5 dark:border-slate-800/70"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {rowActions(row)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ───── Desktop: tabela ───── */}
          <div className="hidden max-h-[65vh] overflow-auto sm:block">
            <table className="table-base">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className={`${c.sortValue || c.sortable ? 'cursor-pointer select-none' : ''} ${c.className || ''}`}
                      onClick={() => toggleSort(c.key, c.sortValue || c.sortable)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.label}
                        {sort?.key === c.key &&
                          (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                      </span>
                    </th>
                  ))}
                  {rowActions && <th className="text-right">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={getRowKey(row)}
                    className={onRowClick ? 'cursor-pointer' : ''}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((c) => (
                      <td key={c.key} className={c.className || ''}>
                        {c.render ? c.render(row) : row[c.key] ?? '—'}
                      </td>
                    ))}
                    {rowActions && (
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">{rowActions(row)}</div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
