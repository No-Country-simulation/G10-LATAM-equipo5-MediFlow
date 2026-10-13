import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Loader2, PencilLine, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useDocumentDetail } from '../../hooks/useDocumentDetail';
import { useDocumentDetailModal } from '../../context/documentDetailContext';
import type { DocumentDetailResponse } from '../../types/medical';
import { DOCUMENT_CORRECTION_ROLES, ESTADOS_CORREGIBLES, canAccessRoute } from '../../utils/permissions';
import { etiquetaDeCodigo } from '../../utils/etiquetas';
import PriorityBadge from '../common/PriorityBadge';
import DocumentStatusBadge from '../common/DocumentStatusBadge';
import DocumentFilesViewer from '../common/DocumentFilesViewer';
import DocumentDetailContent from './DocumentDetailContent';
import DocumentCorrectionPanel from './DocumentCorrectionPanel';

interface DocumentDetailModalProps {
  documentoId: string;
  onClose: () => void;
}

const esCorregible = (detail: DocumentDetailResponse): boolean =>
  (ESTADOS_CORREGIBLES as readonly string[]).includes(detail.estado);

/**
 * Detalle de un documento a pantalla completa: original a la izquierda y datos a la derecha.
 * ADMIN y AUDITOR_CLINICO pueden corregir un documento PROCESADO o AUDITADO desde aquí.
 */
const DocumentDetailModal = ({ documentoId, onClose }: DocumentDetailModalProps) => {
  const { user } = useAuth();
  const { notificarCambio } = useDocumentDetailModal();
  const { detail, loading, error, recargar } = useDocumentDetail(documentoId);
  const [editando, setEditando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const puedeCorregir =
    detail !== null && canAccessRoute(user?.role, DOCUMENT_CORRECTION_ROLES) && esCorregible(detail);

  useEffect(() => {
    // Mientras se corrige, Escape no cierra: se perderían los cambios (se sale con "Cancelar").
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !editando) onClose();
    };
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflowPrevio;
    };
  }, [onClose, editando]);

  const alGuardar = () => {
    setEditando(false);
    setGuardado(true);
    recargar();
    notificarCambio();
  };

  const empezarCorreccion = () => {
    setGuardado(false);
    setEditando(true);
  };

  // Portal en <body>: un ancestro con `transform` (animaciones de la página) confinaría el `fixed`.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="detalle-documento-titulo"
      className="fixed inset-0 z-50 flex flex-col p-2 sm:p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && !editando && onClose()}
    >
      <div className="flex items-center justify-between gap-3 px-1 pb-3">
        <div className="min-w-0 flex flex-wrap items-center gap-2">
          <h2 id="detalle-documento-titulo" className="font-mono text-sm font-bold text-white truncate">
            {documentoId}
          </h2>
          {detail && (
            <>
              <span className="text-xs text-slate-400">{etiquetaDeCodigo(detail.tipo_documento)}</span>
              <PriorityBadge prioridad={detail.nivel_prioridad} />
              <DocumentStatusBadge estado={detail.estado} requiereAuditoria={detail.requiere_auditoria} />
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar detalle"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {loading && !detail && (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <p className="text-sm">Cargando detalle del documento...</p>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      )}

      {detail && (
        // En pantallas anchas cada columna tiene su propio scroll; en angostas se apilan y scrollea el conjunto.
        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DocumentFilesViewer
            archivos={detail.archivos}
            aviso={detail.aviso_archivos}
            expiraEnMinutos={detail.preview_expira_en_minutos}
          />
          {editando ? (
            <DocumentCorrectionPanel detail={detail} onCancel={() => setEditando(false)} onSaved={alGuardar} />
          ) : (
            <div className="flex flex-col min-h-0 min-w-0 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-800/80 bg-slate-800/30 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white">Detalle del documento</h3>
                  <p className="text-xs text-slate-400">Datos extraídos por la IA o corregidos por una persona.</p>
                </div>
                {puedeCorregir && (
                  <button
                    type="button"
                    onClick={empezarCorreccion}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all cursor-pointer"
                  >
                    <PencilLine className="w-3.5 h-3.5" />
                    Corregir
                  </button>
                )}
              </div>
              {guardado && (
                <div role="status" className="mx-4 mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Corrección guardada. Quedó registrada en el historial de cambios.
                </div>
              )}
              <DocumentDetailContent detail={detail} />
            </div>
          )}
        </div>
      )}
    </div>,
    document.body
  );
};

export default DocumentDetailModal;
