import type { HTMLAttributes, KeyboardEvent } from 'react';

/**
 * Props para que una tarjeta completa actúe como botón (clic, Enter o espacio) y sea accesible.
 * La tarjeta no debe contener otros controles interactivos.
 */
export const tarjetaClickeable = (
  accion: () => void,
  etiqueta: string
): HTMLAttributes<HTMLDivElement> => ({
  role: 'button',
  tabIndex: 0,
  'aria-label': etiqueta,
  onClick: accion,
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      accion();
    }
  },
});

/** Clases comunes de una tarjeta clickeable: cursor y foco visible con teclado. */
export const TARJETA_CLICKEABLE_CLASES =
  'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60';
