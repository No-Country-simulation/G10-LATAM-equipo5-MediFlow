import { useEffect, useState } from 'react';
import { catalogService } from '../services/catalogService';
import type { AreaSummary } from '../types/auth';

/** Áreas activas para los selectores. `enabled` evita pedirlas mientras el formulario está cerrado. */
export const useActiveAreas = (enabled: boolean) => {
  const [areas, setAreas] = useState<AreaSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    catalogService
      .getActiveAreas()
      .then((data) => {
        if (!cancelled) setAreas(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudieron cargar las áreas');
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { areas, error };
};
