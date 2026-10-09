import type { ReactNode } from 'react';
import type { DocumentListItemResponse } from '../../types/medical';
import DocumentsKanbanCard from './DocumentsKanbanCard';

interface DocumentsKanbanColumnProps {
  title: string;
  count: number;
  icon: ReactNode;
  borderClass: string;
  badgeClass: string;
  docs: DocumentListItemResponse[];
  isExpanded?: boolean;
}

const DocumentsKanbanColumn = ({
  title,
  count,
  icon,
  borderClass,
  badgeClass,
  docs,
  isExpanded = false,
}: DocumentsKanbanColumnProps) => {
  if (isExpanded) {
    return (
      <div className={`w-full max-w-5xl mx-auto rounded-xl bg-slate-900/50 border ${borderClass} p-5 flex flex-col`}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            {icon}
            <h2 className="text-sm font-bold text-slate-100 tracking-tight">{title}</h2>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${badgeClass}`}>
            {count} {count === 1 ? 'expediente' : 'expedientes'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-4 overflow-y-auto max-h-[calc(100vh-290px)] pr-1.5 scrollbar-thin">
          {docs.length === 0 ? (
            <div className="col-span-full py-16 text-center text-xs text-slate-500 font-medium">
              Sin derivaciones activas
            </div>
          ) : (
            docs.map((doc) => <DocumentsKanbanCard key={doc.documento_id} doc={doc} />)
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-[calc(100vh-270px)] flex flex-col rounded-xl bg-slate-900/50 border ${borderClass} p-3.5`}>
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-xs font-bold text-slate-100 tracking-tight">{title}</h2>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold border ${badgeClass}`}>
          {count}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto pr-1.5 space-y-3 mt-3 scrollbar-thin">
        {docs.length === 0 ? (
          <div className="h-full flex items-center justify-center p-6 rounded-xl border border-dashed border-slate-800/70 text-center">
            <p className="text-xs text-slate-500 font-medium">Sin derivaciones activas</p>
          </div>
        ) : (
          docs.map((doc) => <DocumentsKanbanCard key={doc.documento_id} doc={doc} />)
        )}
      </div>
    </div>
  );
};

export default DocumentsKanbanColumn;
