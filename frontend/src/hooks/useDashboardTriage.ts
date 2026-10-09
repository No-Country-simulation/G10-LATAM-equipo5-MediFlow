import { useState, useEffect, useMemo, useCallback, useReducer } from 'react';
import type { TriageDocument, TriageFilter } from '../types/triage';
import { mapDocumentListItemToTriageDoc } from '../types/triage';
import { documentService } from '../services/documentService';
import { normalizePriority } from '../types/medical';
import { triageReducer, initialTriageState } from './triageReducer';

export interface TriageCounts {
  all: number;
  urgent: number;
  priority: number;
  audit: number;
  routine: number;
}



const withNormalizedProps = (doc: TriageDocument): TriageDocument => ({
  ...doc,
  nivel_prioridad: doc.nivel_prioridad ?? doc.clasificacion?.nivel_prioridad,
  requiere_auditoria:
    doc.requiere_auditoria ?? doc.decision_enrutamiento?.requiere_auditoria_humana ?? false,
  estado:
    doc.estado ?? (doc.status === 'en_revision' ? 'PENDIENTE_AUDITORIA' : 'PROCESADO'),
});

export const useDashboardTriage = () => {
  const [activeFilter, setActiveFilter] = useState<TriageFilter>('ALL');
  const [{ documents, loading, error }, dispatch] = useReducer(triageReducer, initialTriageState);
  const [refreshIndex, setRefreshIndex] = useState<number>(0);

  const reload = useCallback(() => {
    setRefreshIndex((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: 'fetch' });

    documentService
      .listDocuments({ page_size: 100 })
      .then((res) => {
        if (cancelled) return;
        const mapped = (res.items ?? []).map(mapDocumentListItemToTriageDoc).map(withNormalizedProps);
        dispatch({ type: 'success', items: mapped });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        dispatch({
          type: 'error',
          message: err instanceof Error ? err.message : 'Error al conectar con backend',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [refreshIndex]);

  const counts: TriageCounts = useMemo(() => {
    return documents.reduce(
      (acc, d) => {
        const priority = normalizePriority(d.nivel_prioridad);
        if (priority === 'Urgente') acc.urgent++;
        if (priority === 'Prioritario') acc.priority++;
        if (priority === 'Rutina') acc.routine++;
        if (d.requiere_auditoria || d.estado === 'PENDIENTE_AUDITORIA') acc.audit++;
        return acc;
      },
      { all: documents.length, urgent: 0, priority: 0, audit: 0, routine: 0 }
    );
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    switch (activeFilter) {
      case 'URGENT':
        return documents.filter((d) => normalizePriority(d.nivel_prioridad) === 'Urgente');
      case 'PRIORITY':
        return documents.filter((d) => normalizePriority(d.nivel_prioridad) === 'Prioritario');
      case 'AUDIT':
        return documents.filter(
          (d) => d.requiere_auditoria || d.estado === 'PENDIENTE_AUDITORIA'
        );
      case 'ROUTINE':
        return documents.filter((d) => normalizePriority(d.nivel_prioridad) === 'Rutina');
      case 'ALL':
      default:
        return documents;
    }
  }, [documents, activeFilter]);

  return {
    documents,
    filteredDocuments,
    counts,
    activeFilter,
    setActiveFilter,
    loading,
    error,
    reload,
  };
};
