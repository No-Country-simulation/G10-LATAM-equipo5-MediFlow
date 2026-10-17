/** Períodos rápidos para filtrar por fecha de ingreso del documento. */
export type DatePreset = 'HOY' | 'ULTIMOS_7' | 'ULTIMOS_7_DIAS' | 'MES_ACTUAL' | 'MES_ANTERIOR' | 'RANGO';

export const DATE_PRESET_OPTIONS: { id: DatePreset; label: string }[] = [
  { id: 'HOY', label: 'Hoy' },
  { id: 'ULTIMOS_7', label: 'Últimos 7 días' },
  { id: 'MES_ACTUAL', label: 'Mes actual' },
  { id: 'MES_ANTERIOR', label: 'Mes anterior' },
  { id: 'RANGO', label: 'Rango personalizado' },
];

/** `YYYY-MM-DD` en hora local (el formato de `<input type="date">`). */
export function toInputDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fromInputDate(value: string): Date | null {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

/** Fechas (inclusive, en hora local) que cubre cada período. */
export function resolveDateRange(
  preset: DatePreset,
  customFrom: string,
  customTo: string,
  now: Date = new Date()
): { from: Date | null; to: Date | null } {
  switch (preset) {
    case 'HOY':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'ULTIMOS_7':
    case 'ULTIMOS_7_DIAS':
      return { from: startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)), to: endOfDay(now) };
    case 'MES_ACTUAL':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
    case 'MES_ANTERIOR':
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    case 'RANGO': {
      const from = customFrom ? fromInputDate(customFrom) : null;
      const to = customTo ? fromInputDate(customTo) : null;
      return { from: from && startOfDay(from), to: to && endOfDay(to) };
    }
  }
}
