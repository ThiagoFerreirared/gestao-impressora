// Campos de formulário padronizados
export function Field({ label, hint, children, className = '' }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

export function Input({ label, hint, className = '', ...props }) {
  return (
    <Field label={label} hint={hint} className={className}>
      <input className="input" {...props} />
    </Field>
  );
}

export function Select({ label, hint, options = [], placeholder, className = '', ...props }) {
  return (
    <Field label={label} hint={hint} className={className}>
      <select className="input" {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) =>
          typeof o === 'object' ? (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ) : (
            <option key={o} value={o}>
              {o}
            </option>
          )
        )}
      </select>
    </Field>
  );
}

export function Textarea({ label, hint, className = '', rows = 3, ...props }) {
  return (
    <Field label={label} hint={hint} className={className}>
      <textarea className="input" rows={rows} {...props} />
    </Field>
  );
}

// Cor: texto + seletor visual lado a lado
export function ColorField({ label = 'Cor', name, hexName, value, hexValue, onChange, className = '' }) {
  return (
    <Field label={label} className={className}>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          name={name}
          value={value}
          onChange={onChange}
          placeholder="Ex: Vermelho fogo"
        />
        <input
          type="color"
          name={hexName}
          value={hexValue || '#888888'}
          onChange={onChange}
          className="h-9 w-12 cursor-pointer rounded-lg border border-slate-300 bg-transparent p-1 dark:border-slate-700"
          title="Seletor de cor"
        />
      </div>
    </Field>
  );
}

export function FormGrid({ children, cols = 2 }) {
  const colsClass = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[cols];
  return <div className={`grid grid-cols-1 gap-3.5 ${colsClass}`}>{children}</div>;
}

export function Checkbox({ label, ...props }) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
        {...props}
      />
      {label}
    </label>
  );
}
