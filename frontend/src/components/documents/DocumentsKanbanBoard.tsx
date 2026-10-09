import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import type { DocumentListItemResponse } from '../../types/medical';
import type { DocumentDestinationFilter } from '../../types/documents';
import { CANONICAL_QUEUES, DESTINATION_LABELS } from '../../types/documents';
import { useCatalogs } from '../../hooks/useCatalogs';
import DocumentsKanbanColumn from './DocumentsKanbanColumn';
import {
  type ColumnConfig,
  QUEUE_VISUALS,
  DEFAULT_QUEUE_VISUAL,
  OTHER_COLUMN,
} from './kanbanConfig';

interface DocumentsKanbanBoardProps {
  documents: DocumentListItemResponse[];
  selectedDestination?: DocumentDestinationFilter;
}

const PAGE_SIZE = 3;

const DocumentsKanbanBoard = ({
  documents,
  selectedDestination = 'ALL',
}: DocumentsKanbanBoardProps) => {
  const { queues } = useCatalogs();
  const [currentPage, setCurrentPage] = useState(0);

  const effectiveQueues = useMemo(() => {
    if (queues.length > 0) return queues;
    return CANONICAL_QUEUES.map((code) => ({
      codigo: code,
      nombre: DESTINATION_LABELS[code] ?? code,
      descripcion_semantica: '',
    }));
  }, [queues]);

  const activeColumns = useMemo<ColumnConfig[]>(() => {
    return effectiveQueues.map((q) => {
      const visual = QUEUE_VISUALS[q.codigo] ?? DEFAULT_QUEUE_VISUAL;
      return {
        id: q.codigo,
        title: q.nombre,
        icon: visual.icon,
        borderClass: visual.borderClass,
        badgeClass: visual.badgeClass,
        code: q.codigo,
      };
    });
  }, [effectiveQueues]);

  const knownCodes = useMemo(() => new Set(effectiveQueues.map((q) => q.codigo)), [effectiveQueues]);

  const groupedColumns = useMemo(() => {
    const validDocs = documents.filter(
      (doc) =>
        !doc.requiere_auditoria &&
        doc.estado !== 'PENDIENTE_AUDITORIA' &&
        doc.estado !== 'DESCARTADO' &&
        (doc.estado === 'PROCESADO' || doc.estado === 'AUDITADO')
    );

    const queueGroups = activeColumns.map((col) => ({
      ...col,
      docs: validDocs.filter((doc) => doc.destino_enrutamiento?.trim() === col.code),
    }));

    const otherDocs = validDocs.filter(
      (doc) => !doc.destino_enrutamiento || !knownCodes.has(doc.destino_enrutamiento.trim())
    );

    const allGroups = [
      ...queueGroups,
      { ...OTHER_COLUMN, docs: otherDocs },
    ];

    if (selectedDestination !== 'ALL') {
      if (selectedDestination === 'OTROS') {
        return [{ ...OTHER_COLUMN, docs: otherDocs }];
      }
      return queueGroups.filter((col) => col.code === selectedDestination);
    }

    return allGroups.filter((col) => col.docs.length > 0);
  }, [activeColumns, documents, knownCodes, selectedDestination]);

  if (groupedColumns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
        <Inbox className="w-8 h-8 mb-2 text-slate-500" />
        <p className="text-sm font-medium">Sin derivaciones para los filtros seleccionados</p>
      </div>
    );
  }

  if (selectedDestination !== 'ALL' && groupedColumns.length === 1) {
    const single = groupedColumns[0];
    return (
      <div className="w-full">
        <div className="max-w-4xl mx-auto">
          <DocumentsKanbanColumn {...single} count={single.docs.length} isExpanded />
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(groupedColumns.length / PAGE_SIZE);
  const safePage = Math.min(currentPage, Math.max(0, totalPages - 1));
  const startIdx = safePage * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, groupedColumns.length);
  const currentColumns = groupedColumns.slice(startIdx, endIdx);

  return (
    <div className="space-y-4 w-full">
      {groupedColumns.length > PAGE_SIZE && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs px-1 text-slate-400">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {groupedColumns.map((col, idx) => {
              const colPage = Math.floor(idx / PAGE_SIZE);
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setCurrentPage(colPage)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer shrink-0 ${
                    colPage === safePage
                      ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                      : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200'
                  }`}
                >
                  <span className="truncate max-w-[120px]">{col.title}</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-950 text-slate-300">
                    {col.docs.length}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              aria-label="Página anterior de colas"
              onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
              disabled={safePage === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Anterior</span>
            </button>
            <button
              type="button"
              aria-label="Página siguiente de colas"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))}
              disabled={safePage >= totalPages - 1}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <span>Siguiente</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start w-full">
        {currentColumns.map((col) => (
          <DocumentsKanbanColumn key={col.id} {...col} count={col.docs.length} />
        ))}
      </div>
    </div>
  );
};

export default DocumentsKanbanBoard;
