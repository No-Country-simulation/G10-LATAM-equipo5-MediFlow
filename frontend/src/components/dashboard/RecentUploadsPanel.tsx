import { Link } from 'react-router-dom';
import { ArrowRight, Inbox } from 'lucide-react';
import type { DocumentListItemResponse } from '../../types/medical';
import DashboardPanel from './DashboardPanel';
import DashboardDocRow from './DashboardDocRow';

interface RecentUploadsPanelProps {
  docs: DocumentListItemResponse[];
}

/** OPERADOR: qué pasó con lo último que subió (procesado, en auditoría o descartado). */
const RecentUploadsPanel = ({ docs }: RecentUploadsPanelProps) => (
  <DashboardPanel
    title="Mis últimas cargas"
    subtitle="Estado de los documentos que subiste"
    action={
      <Link
        to="/documentos"
        className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors"
      >
        Ver todos
        <ArrowRight className="w-3 h-3" />
      </Link>
    }
  >
    {docs.length === 0 ? (
      <div className="flex flex-col items-center gap-2 py-6 text-xs text-slate-400">
        <Inbox className="w-6 h-6 text-slate-600" />
        Aún no has subido documentos.
      </div>
    ) : (
      <ul>
        {docs.map((doc) => (
          <DashboardDocRow key={doc.documento_id} doc={doc} showStatus />
        ))}
      </ul>
    )}
  </DashboardPanel>
);

export default RecentUploadsPanel;
