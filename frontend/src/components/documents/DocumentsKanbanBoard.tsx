import { useMemo } from 'react';
import { Activity, Pill, FileCheck, FileText } from 'lucide-react';
import type { TriageDocument } from '../../types/triage';
import DocumentsKanbanColumn from './DocumentsKanbanColumn';

interface DocumentsKanbanBoardProps {
  documents: TriageDocument[];
}

interface ColumnDefinition {
  id: string;
  title: string;
  icon: React.ReactNode;
  borderClass: string;
  badgeClass: string;
  match: (dest: string) => boolean;
}

const COLUMNS: ColumnDefinition[] = [
  {
    id: 'urgencias',
    title: 'Urgencias',
    icon: <Activity className="w-4 h-4 text-rose-400" />,
    borderClass: 'border-rose-500/30 bg-rose-950/10',
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    match: (d) =>
      d === 'Cola_Emergencia_Medica' ||
      d === 'Urgencias' ||
      d === 'COLA_URGENCIAS_PRIORITARIA',
  },
  {
    id: 'farmacia',
    title: 'Farmacia',
    icon: <Pill className="w-4 h-4 text-emerald-400" />,
    borderClass: 'border-emerald-500/30 bg-emerald-950/10',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    match: (d) =>
      d === 'Farmacia_Hospitalaria' ||
      d === 'Farmacia' ||
      d === 'Farmacia Hospitalaria' ||
      d === 'FARMACIA_DESPACHO',
  },
  {
    id: 'autorizaciones',
    title: 'Autorizaciones',
    icon: <FileCheck className="w-4 h-4 text-indigo-400" />,
    borderClass: 'border-indigo-500/30 bg-indigo-950/10',
    badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    match: (d) =>
      d === 'Auditoria_Autorizaciones' ||
      d === 'Autorizaciones' ||
      d === 'AUDITORIA_AUTORIZACIONES',
  },
  {
    id: 'ficha',
    title: 'Ficha Clínica',
    icon: <FileText className="w-4 h-4 text-purple-400" />,
    borderClass: 'border-purple-500/30 bg-purple-950/10',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    match: (d) =>
      d === 'Historia_Clinica_Electronica' ||
      d === 'Ficha Clínica' ||
      d === 'HISTORIA_CLINICA_ELECTRONICA',
  },
];

const DocumentsKanbanBoard = ({ documents }: DocumentsKanbanBoardProps) => {
  const groupedDocuments = useMemo(() => {
    return COLUMNS.map((col) => ({
      ...col,
      docs: documents.filter((doc) =>
        col.match(doc.decision_enrutamiento.destino_principal)
      ),
    }));
  }, [documents]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start w-full">
      {groupedDocuments.map((col) => (
        <DocumentsKanbanColumn
          key={col.id}
          title={col.title}
          count={col.docs.length}
          icon={col.icon}
          borderClass={col.borderClass}
          badgeClass={col.badgeClass}
          docs={col.docs}
        />
      ))}
    </div>
  );
};

export default DocumentsKanbanBoard;
