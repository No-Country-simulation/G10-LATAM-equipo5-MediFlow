import { useState, useMemo, type ReactNode } from 'react';
import {
  Activity,
  Pill,
  Microscope,
  Syringe,
  ArrowLeftRight,
  FileText,
  FolderArchive,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from 'lucide-react';
import type { DocumentListItemResponse } from '../../types/medical';
import type { DocumentDestinationFilter } from '../../types/documents';
import DocumentsKanbanColumn from './DocumentsKanbanColumn';

interface DocumentsKanbanBoardProps {
  documents: DocumentListItemResponse[];
  selectedDestination?: DocumentDestinationFilter;
}

interface ColumnConfig {
  id: string;
  title: string;
  icon: ReactNode;
  borderClass: string;
  badgeClass: string;
  code: string;
}

const CANONICAL_COLUMNS: ColumnConfig[] = [
  {
    id: 'urgencias',
    title: 'Urgencias',
    icon: <Activity className="w-4 h-4 text-rose-400" />,
    borderClass: 'border-rose-500/30 bg-rose-950/10',
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    code: 'Cola_Emergencia_Medica',
  },
  {
    id: 'farmacia',
    title: 'Farmacia',
    icon: <Pill className="w-4 h-4 text-emerald-400" />,
    borderClass: 'border-emerald-500/30 bg-emerald-950/10',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    code: 'Farmacia_Hospitalaria',
  },
  {
    id: 'oncologia',
    title: 'Oncología',
    icon: <Microscope className="w-4 h-4 text-pink-400" />,
    borderClass: 'border-pink-500/30 bg-pink-950/10',
    badgeClass: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
    code: 'Cola_Oncologia',
  },
  {
    id: 'procedimientos',
    title: 'Procedimientos',
    icon: <Syringe className="w-4 h-4 text-amber-400" />,
    borderClass: 'border-amber-500/30 bg-amber-950/10',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    code: 'Gestion_Procedimientos',
  },
  {
    id: 'interconsultas',
    title: 'Interconsultas',
    icon: <ArrowLeftRight className="w-4 h-4 text-sky-400" />,
    borderClass: 'border-sky-500/30 bg-sky-950/10',
    badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    code: 'Gestion_Interconsultas',
  },
  {
    id: 'ficha',
    title: 'Ficha Clínica',
    icon: <FileText className="w-4 h-4 text-purple-400" />,
    borderClass: 'border-purple-500/30 bg-purple-950/10',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    code: 'Ficha_Clinica',
  },
];

const OTHER_COLUMN: ColumnConfig = {
  id: 'otros',
  title: 'Otras Derivaciones',
  icon: <FolderArchive className="w-4 h-4 text-slate-400" />,
  borderClass: 'border-slate-600/30 bg-slate-800/10',
  badgeClass: 'bg-slate-700/30 text-slate-400 border-slate-600/30',
  code: 'OTRO',
};

const PAGE_SIZE = 3;
const KNOWN_CODES = new Set(CANONICAL_COLUMNS.map((col) => col.code));

const DocumentsKanbanBoard = ({
  documents,
  selectedDestination = 'ALL',
}: DocumentsKanbanBoardProps) => {
  const [currentPage, setCurrentPage] = useState(0);

  const groupedColumns = useMemo(() => {
    const canonicalGroups = CANONICAL_COLUMNS.map((col) => ({
      ...col,
      docs: documents.filter((doc) => doc.destino_enrutamiento === col.code),
    }));

    const otherDocs = documents.filter(
      (doc) => !doc.destino_enrutamiento || !KNOWN_CODES.has(doc.destino_enrutamiento)
    );

    const allGroups = [
      ...canonicalGroups,
      { ...OTHER_COLUMN, docs: otherDocs },
    ];

    if (selectedDestination !== 'ALL') {
      if (selectedDestination === 'OTROS') {
        return [{ ...OTHER_COLUMN, docs: otherDocs }];
      }
      return canonicalGroups.filter((col) => col.code === selectedDestination);
    }

    return allGroups.filter((col) => col.docs.length > 0);
  }, [documents, selectedDestination]);

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
