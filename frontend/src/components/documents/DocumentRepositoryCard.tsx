import { FileText, User, Stethoscope, ArrowRight, ShieldCheck } from 'lucide-react';
import type { DocumentListItemResponse } from '../../types/medical';
import { DESTINATION_LABELS, CATEGORY_LABELS } from '../../types/documents';
import PriorityBadge from '../common/PriorityBadge';
import DocumentStatusBadge from '../common/DocumentStatusBadge';
import OciPath from './OciPath';
import { formatIdentificacion } from '../../utils/identificacion';
import { useDocumentDetailModal } from '../../context/documentDetailContext';
import { tarjetaClickeable, TARJETA_CLICKEABLE_CLASES } from '../../utils/clickableCard';

interface DocumentRepositoryCardProps {
  doc: DocumentListItemResponse;
}

const destinationLookup: Record<string, string> = DESTINATION_LABELS;
const categoryLookup: Record<string, string> = CATEGORY_LABELS;

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatConfidence(score: number | null | undefined): string {
  if (typeof score !== 'number' || Number.isNaN(score)) return '—';
  return `${(score * 100).toFixed(0)}%`;
}

const DocumentRepositoryCard = ({ doc }: DocumentRepositoryCardProps) => {
  const { abrirDocumento } = useDocumentDetailModal();
  const destinationLabel = doc.destino_enrutamiento
    ? (destinationLookup[doc.destino_enrutamiento] ?? doc.destino_enrutamiento)
    : 'Otras Derivaciones';

  const categoryLabel = categoryLookup[doc.tipo_documento] ?? doc.tipo_documento;
  const formattedDate = formatDate(doc.created_at);
  const confidencePercent = formatConfidence(doc.score_confianza);
  const clinicalDiagnosis =
    doc.diagnostico_principal ||
    (doc.estado === 'DESCARTADO' ? 'Expediente descartado en auditoría' : null) ||
    'Sin diagnóstico registrado';

  return (
    <div
      {...tarjetaClickeable(() => abrirDocumento(doc.documento_id), `Ver detalle del documento ${doc.documento_id}`)}
      className={`${TARJETA_CLICKEABLE_CLASES} p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all space-y-3`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-slate-800/80 text-rose-400">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="font-mono text-xs font-bold text-white tracking-tight">
              {doc.documento_id}
            </div>
            <div className="text-[11px] text-slate-400 font-medium">{categoryLabel}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <DocumentStatusBadge estado={doc.estado} requiereAuditoria={doc.requiere_auditoria} />
          <PriorityBadge prioridad={doc.nivel_prioridad} />
          <span className="text-[10px] text-slate-500 font-mono">{formattedDate}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
          <div className="text-[10px] text-slate-500 uppercase font-mono flex items-center gap-1">
            <User className="w-3 h-3" />
            <span>Paciente</span>
          </div>
          <div className="font-semibold text-slate-200 mt-1 truncate">
            {doc.nombre_paciente ?? '—'}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            {formatIdentificacion(doc.identificacion_paciente, doc.tipo_identificacion)}
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 sm:col-span-1 lg:col-span-2">
          <div className="text-[10px] text-slate-500 uppercase font-mono flex items-center gap-1">
            <Stethoscope className="w-3 h-3 text-rose-400" />
            <span>Hipótesis Diagnóstica</span>
          </div>
          <div className="font-semibold text-slate-200 mt-1 truncate">{clinicalDiagnosis}</div>
          <div className="text-[11px] text-slate-400 font-mono">Expediente: {doc.documento_id}</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-xs">
        <div className="flex items-center gap-1.5 text-slate-300">
          <span className="text-slate-500">Derivación:</span>
          <span className="font-medium text-emerald-400">{destinationLabel}</span>
          <ArrowRight className="w-3 h-3 text-slate-600" />
        </div>

        <OciPath path={doc.oci_json_path} className="sm:max-w-[45%]" />

        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Confianza IA:</span>
          <span className="font-mono font-bold text-slate-200">{confidencePercent}</span>
        </div>
      </div>
    </div>
  );
};

export default DocumentRepositoryCard;
