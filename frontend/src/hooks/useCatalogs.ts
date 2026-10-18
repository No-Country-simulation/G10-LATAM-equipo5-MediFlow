import { useState, useEffect } from 'react';
import { documentService } from '../services/documentService';
import type { QueueActiveForLLM, DocumentTypeActiveForLLM } from '../types/catalog';
import { createSharedLoader } from '../utils/sharedLoader';

export interface UseCatalogsReturn {
  queues: QueueActiveForLLM[];
  documentTypes: DocumentTypeActiveForLLM[];
  loading: boolean;
  error: string | null;
}

/** Colas y tipos activos (filtros, columnas del kanban, selects): una sola carga compartida. */
const activeCatalogs = createSharedLoader(async () => {
  const [queues, documentTypes] = await Promise.all([
    documentService.getActiveQueues(),
    documentService.getActiveDocumentTypes(),
  ]);
  return { queues: queues ?? [], documentTypes: documentTypes ?? [] };
});

/** Descarta la carga compartida: se llama tras crear, editar o eliminar un registro de catálogo. */
export const invalidateActiveCatalogs = activeCatalogs.invalidate;

export const useCatalogs = (): UseCatalogsReturn => {
  const [queues, setQueues] = useState<QueueActiveForLLM[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeActiveForLLM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    activeCatalogs
      .load()
      .then((catalogs) => {
        if (cancelled) return;
        setQueues(catalogs.queues);
        setDocumentTypes(catalogs.documentTypes);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error al cargar catálogos');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { queues, documentTypes, loading, error };
};
