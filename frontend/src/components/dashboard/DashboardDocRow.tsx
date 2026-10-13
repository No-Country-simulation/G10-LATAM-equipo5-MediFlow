import type { DocumentListItemResponse } from '../../types/medical';
import { CATEGORY_LABELS } from '../../types/documents';
import PriorityBadge from '../common/PriorityBadge';
import DocumentStatusBadge from '../common/DocumentStatusBadge';
import { useDocumentDetailModal } from '../../context/documentDetailContext';
import { tarjetaClickeable, TARJETA_CLICKEABLE_CLASES } from '../../utils/clickableCard';
import { timeAgo } from '../../utils/timeAgo';

const categoryLookup: Record<string, string> = CATEGORY_LABELS;

interface DashboardDocRowProps {
  doc: DocumentListItemResponse;
  /** Texto del tiempo; por defecto, desde el ingreso. */
  timeLabel?: string;
  showStatus?: boolean;
}

/** Fila compacta de documento para los paneles del inicio; abre el detalle al hacer clic. */
const DashboardDocRow = ({ doc, timeLabel, showStatus = false }: DashboardDocRowProps) => {
  const { abrirDocumento } = useDocumentDetailModal();

  return (
    <li>
      <div
        {...tarjetaClickeable(() => abrirDocumento(doc.documento_id), `Ver detalle del documento ${doc.documento_id}`)}
        className={`${TARJETA_CLICKEABLE_CLASES} flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800/50 transition-colors`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono font-bold text-slate-200 truncate">{doc.documento_id}</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400 truncate">{categoryLookup[doc.tipo_documento] ?? doc.tipo_documento}</span>
          </div>
          <div className="text-[11px] text-slate-400 truncate mt-0.5">
            {doc.nombre_paciente ?? 'Paciente sin nombre'}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {showStatus && <DocumentStatusBadge estado={doc.estado} requiereAuditoria={doc.requiere_auditoria} />}
          <PriorityBadge prioridad={doc.nivel_prioridad} showDot={false} />
          <span className="text-[10px] text-slate-500 w-16 text-right">{timeLabel ?? timeAgo(doc.created_at)}</span>
        </div>
      </div>
    </li>
  );
};

export default DashboardDocRow;
