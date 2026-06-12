// Badge de status a partir de um mapa de constantes ({key: {label, badge}})
export default function StatusBadge({ map, value, fallback = 'badge-gray' }) {
  const item = map?.[value];
  return <span className={item?.badge || fallback}>{item?.label || value || '—'}</span>;
}

export function ColorDot({ hex, size = 14 }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full border border-black/20 dark:border-white/25"
      style={{ backgroundColor: hex || '#888', width: size, height: size }}
    />
  );
}
