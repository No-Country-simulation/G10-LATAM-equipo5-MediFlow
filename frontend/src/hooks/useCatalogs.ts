import { useState, useEffect } from 'react';
import { documentService } from '../services/documentService';
import type { QueueActiveForLLM, DocumentTypeActiveForLLM } from '../types/catalog';

export interface UseCatalogsReturn {
  queues: QueueActiveForLLM[];
  documentTypes: DocumentTypeActiveForLLM[];
  loading: boolean;
  error: string | null;
}

export const useCatalogs = (): UseCatalogsReturn => {
  const [queues, setQueues] = useState<QueueActiveForLLM[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeActiveForLLM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      documentService.getActiveQueues(),
      documentService.getActiveDocumentTypes(),
    ])
      .then(([activeQueues, activeDocTypes]) => {
        if (cancelled) return;
        setQueues(activeQueues ?? []);
        setDocumentTypes(activeDocTypes ?? []);
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
