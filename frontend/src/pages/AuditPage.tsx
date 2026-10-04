import { useMemo, useState } from 'react';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import { useDocumentList } from '../hooks/useDocumentList';
import type { DocumentListItemResponse } from '../types/medical';
import AuditDocumentCard from '../components/audit/AuditDocumentCard';

const AuditPage = () => {
  const { documents, state, reload } = useDocumentList({ page_size: 100 });
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(() => new Set());

  const pendientes = useMemo(() => {
    return documents.filter(
      (d) =>
        (d.requiere_auditoria === true || d.estado === 'PENDIENTE_AUDITORIA') &&
        !reviewedIds.has(d.documento_id)
    );
  }, [documents, reviewedIds]);

  const handleReview = (doc: DocumentListItemResponse) => {
    setReviewedIds((prev) => new Set(prev).add(doc.documento_id));
  };

  return (
    <div className="max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Bandeja de Auditoría Clínica (Human-in-the-Loop)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {pendientes.length} {pendientes.length === 1 ? 'pendiente' : 'pendientes'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Revisión asistida y validación humana de casos con confianza subóptima o hallazgos complejos.
          </p>
        </div>

        <button
          type="button"
          onClick={reload}
          disabled={state === 'loading'}
          aria-label="Actualizar bandeja de auditoría"
          className="self-start sm:self-center p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${state === 'loading' ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {state === 'loading' && (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-36 rounded-2xl bg-slate-900/50 border border-slate-800 animate-pulse"
            />
          ))}
        </div>
      )}

      {state !== 'loading' && pendientes.length === 0 && (
        <div className="p-12 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-sm font-semibold text-white">
            No hay documentos pendientes de auditoría.
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Todos los documentos clínicos han sido validados o procesados autónomamente por el sistema.
          </p>
        </div>
      )}

      {state !== 'loading' && pendientes.length > 0 && (
        <div className="space-y-3.5">
          {pendientes.map((doc) => (
            <AuditDocumentCard key={doc.documento_id} doc={doc} onReview={handleReview} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AuditPage;
