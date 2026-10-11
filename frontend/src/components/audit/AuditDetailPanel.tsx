import { useState } from 'react';
import { AlertCircle, X, Loader2 } from 'lucide-react';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useAuditDetailForm } from '../../hooks/useAuditDetailForm';
import { useDocumentForms } from '../../hooks/useDocumentForms';
import DocumentFilesViewer from '../common/DocumentFilesViewer';
import AuditClinicalForm from './AuditClinicalForm';
import AuditActionButtons from './AuditActionButtons';

interface AuditDetailPanelProps {
  documentId: string;
  onClose: () => void;
}

const AuditDetailPanel = ({ documentId, onClose }: AuditDetailPanelProps) => {
  const { queues } = useCatalogs();
  const { forms, error: formsError } = useDocumentForms();
  const [discardMode, setDiscardMode] = useState(false);
  const audit = useAuditDetailForm(documentId, onClose, forms);
  const { detail, loading, error, submitting, handleDiscard, handleCancel } = audit;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p>Cargando detalle del caso...</p>
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
        <AlertCircle className="w-5 h-5" />
        <div className="text-sm font-semibold">{error}</div>
        <button type="button" onClick={onClose} className="ml-auto text-xs underline cursor-pointer">
          Volver
        </button>
      </div>
    );
  }

  return (
    // En pantallas anchas el panel ocupa el alto disponible (pantalla - navbar - márgenes) y cada
    // columna tiene su propio scroll vertical; en pantallas angostas se apila con su alto natural.
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:h-[calc(100vh-10rem)] lg:min-h-[32rem]">
      <DocumentFilesViewer
        archivos={detail?.archivos ?? []}
        fallbackUrl={detail?.oci_preview_url}
        expiraEnMinutos={detail?.preview_expira_en_minutos}
      />

      <div className="flex flex-col min-h-0 min-w-0 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800/80 bg-slate-800/30 flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold text-white">Corrección y Validación</h3>
            <p className="text-xs text-slate-400">Corrige los datos extraídos antes de enrutar el documento.</p>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Cerrar y Liberar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!discardMode && (
          <AuditClinicalForm
            forms={forms}
            formsError={formsError}
            queues={queues}
            motivos={detail?.motivos_auditoria}
            error={error}
            clasificacion={audit.clasificacion}
            datosGenerales={audit.datosGenerales}
            detalle={audit.detalle}
            auditNotes={audit.auditNotes}
            onClasificacionChange={audit.handleClasificacionChange}
            onDatosGeneralesChange={audit.setDatosGenerales}
            onDetalleChange={audit.setCampoDetalle}
            onAuditNotesChange={audit.setAuditNotes}
            handleResolve={(e) => void audit.handleResolve(e)}
          />
        )}

        <AuditActionButtons
          discardMode={discardMode}
          setDiscardMode={setDiscardMode}
          motivoDescarte={audit.motivoDescarte}
          handleChange={audit.handleMotivoChange}
          handleDiscard={handleDiscard}
          handleCancel={handleCancel}
          submitting={submitting}
        />
      </div>
    </div>
  );
};

export default AuditDetailPanel;
