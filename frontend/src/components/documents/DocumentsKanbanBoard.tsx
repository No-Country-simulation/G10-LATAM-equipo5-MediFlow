import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import type { DocumentListItemResponse } from '../../types/medical';
import type { DocumentDestinationFilter } from '../../types/documents';
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

  const activeColumns = useMemo<ColumnConfig[]>(() => {
    return queues.map((q) => {
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
  }, [queues]);

  const knownCodes = useMemo(() => new Set(queues.map((q) => q.codigo)), [queues]);

  const groupedColumns = useMemo(() => {
    const queueGroups = activeColumns.map((col) => ({
      ...col,
      docs: documents.filter((doc) => doc.destino_enrutamiento === col.code),
    }));

    const otherDocs = documents.filter(
      (doc) => !doc.destino_enrutamiento || !knownCodes.has(doc.destino_enrutamiento)
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
        <div className="flex items-center justify-between text-xs px-1 text-slate-400">
          <span>
            Mostrando {startIdx + 1}–{endIdx} de {groupedColumns.length} colas activas
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Página anterior de colas"
              onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
              disabled={safePage === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Anterior</span>
            </button>
            <button
              type="button"
              aria-label="Página siguiente de colas"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))}
              disabled={safePage >= totalPages - 1}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
