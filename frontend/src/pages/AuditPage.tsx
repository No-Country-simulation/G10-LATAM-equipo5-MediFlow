import { useMemo, useState } from 'react';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import { useDocumentList } from '../hooks/useDocumentList';
import { documentService } from '../services/documentService';
import type { DocumentListItemResponse } from '../types/medical';
import AuditDocumentCard from '../components/audit/AuditDocumentCard';
import AuditDetailPanel from '../components/audit/AuditDetailPanel';

const AuditPage = () => {
  const { documents, state, reload, error: listError } = useDocumentList({ page_size: 100, estado: 'PENDIENTE_AUDITORIA' });
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);

  const pendientes = useMemo(() => documents, [documents]);

  const handleReview = async (doc: DocumentListItemResponse) => {
    setClaimError(null);
    setClaiming(doc.documento_id);
    try {
      await documentService.claimAuditCase(doc.documento_id);
      setActiveDocId(doc.documento_id);
    } catch (err) {
      const error = err as { status?: number; message?: string };
      if (error?.status === 409) {
        setClaimError(`El caso ${doc.documento_id} ya fue tomado por otro auditor o no está pendiente.`);
      } else {
        setClaimError(error.message || 'No se pudo tomar el caso.');
      }
      reload();
    } finally {
      setClaiming(null);
    }
  };

  const handleCloseDetail = () => {
    setActiveDocId(null);
    reload();
  };

  if (activeDocId) {
    return (
      <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-4 animate-fade-in">
        <AuditDetailPanel documentId={activeDocId} onClose={handleCloseDetail} />
      </div>
    );
  }

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

      {claimError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center justify-between">
          <span>{claimError}</span>
          <button onClick={() => setClaimError(null)} className="text-rose-400 hover:text-rose-300">
            Cerrar
          </button>
        </div>
      )}

      {listError && !claimError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          {listError}
        </div>
      )}

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
            <AuditDocumentCard
              key={doc.documento_id}
              doc={doc}
              onReview={handleReview}
              isClaiming={claiming === doc.documento_id}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AuditPage;
