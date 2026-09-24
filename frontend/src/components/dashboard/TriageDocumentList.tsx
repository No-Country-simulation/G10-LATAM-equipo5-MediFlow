import { AlertCircle, FileText, CheckCircle2, Cloud, ArrowUpRight } from 'lucide-react';
import type { TriageDocument } from '../../types/triage';

interface TriageDocumentListProps {
  documents: TriageDocument[];
  onSelectDocument?: (document: TriageDocument) => void;
}

const TriageDocumentList = ({ documents, onSelectDocument }: TriageDocumentListProps) => {
  if (documents.length === 0) {
    return (
      <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs">
        No se encontraron documentos para el filtro seleccionado.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => {
        const isUrgent = doc.clasificacion.nivel_prioridad === 'Urgente';
        const requiresAudit =
          doc.clasificacion.score_confianza_clasificacion < 0.85 ||
          doc.decision_enrutamiento.requiere_auditoria_humana;
        const confidencePct = Math.round(doc.clasificacion.score_confianza_clasificacion * 100);

        return (
          <div
            key={doc.documento_id}
            onClick={() => onSelectDocument?.(doc)}
            className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all space-y-3 cursor-pointer group"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-200">
                  {doc.documento_id}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-slate-400 font-medium">
                  {doc.clasificacion.tipo_documento}
                </span>
              </div>

              <div>
                {isUrgent ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Urgencia Crítica ({confidencePct}%)
                  </span>
                ) : requiresAudit ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    <FileText className="w-3.5 h-3.5" />
                    Requiere Auditoría ({confidencePct}%)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Rutina Aprobada ({confidencePct}%)
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-slate-400 font-medium">Paciente / Médico:</div>
                <div className="text-slate-200 font-semibold mt-0.5">
                  {doc.datos_extraidos.paciente.nome} ({doc.datos_extraidos.paciente.edad} años)
                </div>
                <div className="text-slate-400 text-[11px]">
                  RUT: {doc.datos_extraidos.paciente.rut || 'N/A'} • {doc.datos_extraidos.medico_solicitante?.nombre}
                </div>
              </div>

              <div>
                <div className="text-slate-400 font-medium">Diagnóstico Principal:</div>
                <div className="text-slate-200 font-semibold mt-0.5 flex items-center gap-1.5">
                  <span>{doc.datos_extraidos.diagnostico_principal}</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                    {doc.datos_extraidos.cie10_sugerido}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 line-clamp-1">
                  {doc.decision_enrutamiento.justificacion_enrutamiento}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Destino:</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 font-mono font-medium">
                  {doc.decision_enrutamiento.destino_principal}
                </span>
              </div>

              {doc.almacenamiento_oci && (
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Cloud className="w-3 h-3 text-sky-400" />
                  <span className="font-mono text-[10px] text-slate-400 truncate max-w-xs">
                    OCI: {doc.almacenamiento_oci.ruta_objeto}
                  </span>
                  <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-slate-200 transition-colors" />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TriageDocumentList;
