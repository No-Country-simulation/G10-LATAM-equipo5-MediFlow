import type { ReactNode } from 'react';
import type { TriageDocument } from '../../types/triage';
import DocumentsKanbanCard from './DocumentsKanbanCard';

interface DocumentsKanbanColumnProps {
  title: string;
  count: number;
  icon: ReactNode;
  borderClass: string;
  badgeClass: string;
  docs: TriageDocument[];
}

const DocumentsKanbanColumn = ({
  title,
  count,
  icon,
  borderClass,
  badgeClass,
  docs,
}: DocumentsKanbanColumnProps) => {
  return (
    <div
      className={`flex flex-col rounded-2xl bg-slate-900/50 border ${borderClass} p-3.5 space-y-3 min-w-[260px] flex-1`}
    >
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-xs font-bold text-slate-100 tracking-tight">
            {title}
          </h2>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold border ${badgeClass}`}
        >
          {count}
        </span>
      </div>

      <div className="space-y-3 flex-1">
        {docs.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-slate-800/70 text-center">
            <p className="text-xs text-slate-500 font-medium">
              Sin derivaciones activas
            </p>
          </div>
        ) : (
          docs.map((doc) => (
            <DocumentsKanbanCard key={doc.documento_id} doc={doc} />
          ))
        )}
      </div>
    </div>
  );
};

export default DocumentsKanbanColumn;
