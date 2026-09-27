import { Inbox } from 'lucide-react';
import type { TriageDocument } from '../../types/triage';
import DocumentRepositoryCard from './DocumentRepositoryCard';

interface DocumentsListViewProps {
  documents: TriageDocument[];
}

const DocumentsListView = ({ documents }: DocumentsListViewProps) => {
  if (documents.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
        <Inbox className="w-8 h-8 text-slate-600 mx-auto" />
        <h3 className="text-sm font-semibold text-white">
          No se encontraron expedientes
        </h3>
        <p className="text-xs text-slate-400">
          No hay documentos clínicos que coincidan con los filtros seleccionados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <DocumentRepositoryCard key={doc.documento_id} doc={doc} />
      ))}
    </div>
  );
};

export default DocumentsListView;
