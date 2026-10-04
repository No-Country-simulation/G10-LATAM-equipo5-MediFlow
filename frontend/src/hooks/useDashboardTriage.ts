import { useState, useEffect, useMemo, useCallback } from 'react';
import type { TriageDocument, TriageFilter } from '../types/triage';
import {
  MOCK_TRIAGE_DOCUMENTS,
  mapDocumentListItemToTriageDoc,
} from '../components/dashboard/triageData';
import { documentService } from '../services/documentService';
import { normalizePriority } from '../components/common/PriorityBadge';

export interface TriageCounts {
  all: number;
  urgent: number;
  priority: number;
  audit: number;
  routine: number;
}

export interface UseDashboardTriageReturn {
  documents: TriageDocument[];
  filteredDocuments: TriageDocument[];
  counts: TriageCounts;
  activeFilter: TriageFilter;
  setActiveFilter: (filter: TriageFilter) => void;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const withNormalizedProps = (doc: TriageDocument): TriageDocument => ({
  ...doc,
  nivel_prioridad: doc.nivel_prioridad ?? doc.clasificacion?.nivel_prioridad,
  requiere_auditoria:
    doc.requiere_auditoria ?? doc.decision_enrutamiento?.requiere_auditoria_humana ?? false,
  estado:
    doc.estado ?? (doc.status === 'en_revision' ? 'PENDIENTE_AUDITORIA' : 'PROCESADO'),
});

const INITIAL_DOCS = MOCK_TRIAGE_DOCUMENTS.map(withNormalizedProps);

export const useDashboardTriage = (): UseDashboardTriageReturn => {
  const [activeFilter, setActiveFilter] = useState<TriageFilter>('ALL');
  const [documents, setDocuments] = useState<TriageDocument[]>(INITIAL_DOCS);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState<number>(0);

  const reload = useCallback(() => {
    setRefreshIndex((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Conexión resiliente a FastAPI con fallback automático a datos de prueba
    documentService
      .listDocuments({ page_size: 100 })
      .then((res) => {
        if (cancelled) return;
        if (res.items && res.items.length > 0) {
          const mapped = res.items.map(mapDocumentListItemToTriageDoc).map(withNormalizedProps);
          setDocuments(mapped);
        } else {
          // Fallback si la base de datos está vacía en fase de pruebas
          setDocuments(INITIAL_DOCS);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Fallback resiliente si FastAPI no está disponible o requiere autenticación
        setDocuments(INITIAL_DOCS);
        setError(err instanceof Error ? err.message : 'Error al conectar con backend');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refreshIndex]);

  const counts: TriageCounts = useMemo(() => {
    const urgent = documents.filter(
      (d) => normalizePriority(d.nivel_prioridad) === 'Urgente'
    ).length;

    const priority = documents.filter(
      (d) => normalizePriority(d.nivel_prioridad) === 'Prioritario'
    ).length;

    const routine = documents.filter(
      (d) => normalizePriority(d.nivel_prioridad) === 'Rutina'
    ).length;

    const audit = documents.filter(
      (d) => Boolean(d.requiere_auditoria || d.estado === 'PENDIENTE_AUDITORIA')
    ).length;

    return {
      all: documents.length,
      urgent,
      priority,
      audit,
      routine,
    };
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    switch (activeFilter) {
      case 'URGENT':
        return documents.filter((d) => normalizePriority(d.nivel_prioridad) === 'Urgente');
      case 'PRIORITY':
        return documents.filter((d) => normalizePriority(d.nivel_prioridad) === 'Prioritario');
      case 'AUDIT':
        return documents.filter(
          (d) => Boolean(d.requiere_auditoria || d.estado === 'PENDIENTE_AUDITORIA')
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
