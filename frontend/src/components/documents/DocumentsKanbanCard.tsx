import { User, Stethoscope, ShieldCheck } from 'lucide-react';
import type { DocumentListItemResponse } from '../../types/medical';
import { CATEGORY_LABELS } from '../../types/documents';
import PriorityBadge from '../common/PriorityBadge';
import DocumentStatusBadge from '../common/DocumentStatusBadge';
import OciPath from './OciPath';
import { formatIdentificacion } from '../../utils/identificacion';
import { useDocumentDetailModal } from '../../context/documentDetailContext';
import { tarjetaClickeable, TARJETA_CLICKEABLE_CLASES } from '../../utils/clickableCard';

interface DocumentsKanbanCardProps {
  doc: DocumentListItemResponse;
}

const categoryLookup: Record<string, string> = CATEGORY_LABELS;

function formatConfidence(score: number | null | undefined): string {
  if (typeof score !== 'number' || Number.isNaN(score)) return '—';
  return `${(score * 100).toFixed(0)}%`;
}

const DocumentsKanbanCard = ({ doc }: DocumentsKanbanCardProps) => {
  const confidencePercent = formatConfidence(doc.score_confianza);
  const categoryLabel = categoryLookup[doc.tipo_documento] ?? doc.tipo_documento;
  const clinicalDiagnosis =
    doc.diagnostico_principal ||
    (doc.estado === 'DESCARTADO' ? 'Expediente descartado en auditoría' : null) ||
    'Sin diagnóstico registrado';
  const { abrirDocumento } = useDocumentDetailModal();

  return (
    <div
      {...tarjetaClickeable(() => abrirDocumento(doc.documento_id), `Ver detalle del documento ${doc.documento_id}`)}
      className={`${TARJETA_CLICKEABLE_CLASES} p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition-all shadow-sm space-y-2.5`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-bold text-slate-200 tracking-tight">
          {doc.documento_id}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <DocumentStatusBadge estado={doc.estado} requiereAuditoria={doc.requiere_auditoria} />
          <PriorityBadge prioridad={doc.nivel_prioridad} />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs">
          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="font-semibold text-slate-100 truncate">
            {doc.nombre_paciente ?? '—'}
          </span>
          {doc.identificacion_paciente && (
            <span className="text-[10px] font-mono text-slate-400 shrink-0">
              ({formatIdentificacion(doc.identificacion_paciente, doc.tipo_identificacion)})
            </span>
          )}
        </div>

        <div className="flex items-start gap-1.5 text-xs text-slate-300">
          <Stethoscope className="w-3.5 h-3.5 text-rose-400/80 shrink-0 mt-0.5" />
          <p className="line-clamp-2 leading-relaxed">
            {clinicalDiagnosis}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-800/70 text-[11px]">
        <div className="font-mono text-[10px] text-slate-400 truncate max-w-[50%]">
          {categoryLabel}
        </div>

        <div className="flex items-center gap-1 text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-mono font-bold text-slate-200">
            {confidencePercent}
          </span>
        </div>
      </div>

      <OciPath path={doc.oci_json_path} />
    </div>
  );
};

export default DocumentsKanbanCard;
