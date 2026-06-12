import { Plus, Trash2 } from 'lucide-react';
import SearchSelect from '../ui/SearchSelect';
import { ColorDot } from '../ui/Badge';
import { costPerGram } from '../../lib/calculations';
import { grams as gramsFmt, money, toNum } from '../../lib/format';
import { AMS_SLOTS } from '../../lib/constants';

// Opções de bobina para o SearchSelect (busca por material, cor e marca)
export const spoolOptions = (spools, { includeEmpty = false } = {}) =>
  spools
    .filter((s) => includeEmpty || (Number(s.currentWeight) || 0) > 0)
    .map((s) => ({
      value: s.id,
      label: `${s.material} ${s.colorName} — ${s.brand}`,
      sublabel: `restam ${gramsFmt(s.currentWeight)} • ${money(costPerGram(s))}/g`,
      render: <ColorDot hex={s.colorHex} />,
    }));

// Editor dos slots do AMS de uma parte do projeto.
// slots: [{ slot, spoolId, gramsPiece, gramsPurge }]
export default function SlotEditor({ slots = [], onChange, spools = [], spoolsById = {} }) {
  const usedNumbers = slots.map((s) => s.slot);
  const nextSlot = AMS_SLOTS.find((n) => !usedNumbers.includes(n));

  const update = (index, patch) =>
    onChange(slots.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const addSlot = () => {
    if (!nextSlot) return;
    onChange([...slots, { slot: nextSlot, spoolId: '', gramsPiece: '', gramsPurge: '' }]);
  };

  const removeSlot = (index) => onChange(slots.filter((_, i) => i !== index));

  return (
    <div className="space-y-2.5">
      {slots.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-400 dark:border-slate-700">
          Nenhum slot do AMS configurado. Adicione os filamentos usados nesta impressão.
        </p>
      )}

      {slots.map((slot, i) => {
        const spool = spoolsById[slot.spoolId];
        const cg = costPerGram(spool);
        const cost = (toNum(slot.gramsPiece) + toNum(slot.gramsPurge)) * cg;
        return (
          <div
            key={i}
            className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/70 dark:bg-slate-800/40"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="badge-blue">Slot AMS {slot.slot}</span>
              <div className="flex items-center gap-3">
                {spool && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Custo: <b className="text-slate-700 dark:text-slate-200">{money(cost)}</b>
                  </span>
                )}
                <button type="button" className="btn-icon !h-7 !w-7" onClick={() => removeSlot(i)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <SearchSelect
                value={slot.spoolId}
                onChange={(v) => update(i, { spoolId: v })}
                options={spoolOptions(spools, { includeEmpty: true })}
                placeholder="Selecionar bobina..."
              />
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <input
                    className="input"
                    inputMode="decimal"
                    placeholder="Peça (g)"
                    value={slot.gramsPiece}
                    onChange={(e) => update(i, { gramsPiece: e.target.value })}
                  />
                  <p className="mt-0.5 text-[10px] text-slate-400">Gramas na peça</p>
                </div>
                <div>
                  <input
                    className="input"
                    inputMode="decimal"
                    placeholder="Purga (g)"
                    value={slot.gramsPurge}
                    onChange={(e) => update(i, { gramsPurge: e.target.value })}
                  />
                  <p className="mt-0.5 text-[10px] text-slate-400">Purga/desperdício</p>
                </div>
              </div>
            </div>
            {spool && (Number(spool.currentWeight) || 0) < toNum(slot.gramsPiece) + toNum(slot.gramsPurge) && (
              <p className="mt-1.5 text-xs font-semibold text-red-500">
                ⚠ A bobina tem só {gramsFmt(spool.currentWeight)} — insuficiente para esta impressão.
              </p>
            )}
          </div>
        );
      })}

      {nextSlot && (
        <button type="button" className="btn-secondary btn-sm" onClick={addSlot}>
          <Plus size={14} /> Adicionar slot do AMS
        </button>
      )}
    </div>
  );
}
