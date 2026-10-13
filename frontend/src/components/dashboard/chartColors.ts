/** Colores de prioridad para los gráficos, validados sobre la superficie oscura (#0f172a):
 * banda de luminosidad, separación para daltonismo (ΔE ≥ 9) y contraste ≥ 3:1. */
export const PRIORITY_SERIES = [
  { key: 'urgente', label: 'Urgente', color: '#e11d48' },
  { key: 'prioritario', label: 'Prioritario', color: '#d97706' },
  { key: 'rutina', label: 'Rutina', color: '#0d9488' },
] as const;

/** Serie única (distribución por cola). */
export const SINGLE_SERIES_COLOR = '#0284c7';
