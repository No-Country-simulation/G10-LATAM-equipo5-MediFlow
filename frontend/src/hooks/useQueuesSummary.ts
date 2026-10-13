import { useEffect, useState } from 'react';
import { catalogService } from '../services/catalogService';
import type { QueueSummary } from '../types/auth';

/** Colas activas (con `id` y si son asistenciales). `enabled` evita pedirlas mientras no se usan. */
export const useQueuesSummary = (enabled: boolean) => {
  const [queues, setQueues] = useState<QueueSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    catalogService
      .getQueuesSummary()
      .then((data) => {
        if (!cancelled) setQueues(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudieron cargar las colas');
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { queues, error };
};
