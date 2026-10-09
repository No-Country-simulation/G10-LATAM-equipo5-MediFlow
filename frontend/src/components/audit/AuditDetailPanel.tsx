import { useState } from 'react';
import { AlertCircle, X, Loader2 } from 'lucide-react';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useAuditDetailForm } from '../../hooks/useAuditDetailForm';
import AuditDocumentViewer from './AuditDocumentViewer';
import AuditClinicalForm from './AuditClinicalForm';
import AuditActionButtons from './AuditActionButtons';

interface AuditDetailPanelProps {
  documentId: string;
  onClose: () => void;
}

const AuditDetailPanel = ({ documentId, onClose }: AuditDetailPanelProps) => {
  const { queues, documentTypes } = useCatalogs();
  const [discardMode, setDiscardMode] = useState(false);
  const {
    detail,
    loading,
    error,
    submitting,
    formData,
    handleChange,
    handleResolve,
    handleDiscard,
    handleCancel,
  } = useAuditDetailForm(documentId, onClose);

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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-8rem)]">
      <AuditDocumentViewer detail={detail} />

      <div className="flex flex-col rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
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
            formData={formData}
            handleChange={handleChange}
            handleResolve={handleResolve}
            documentTypes={documentTypes}
            queues={queues}
            detail={detail}
            error={error}
          />
        )}

        <AuditActionButtons
          discardMode={discardMode}
          setDiscardMode={setDiscardMode}
          motivoDescarte={formData.motivo_descarte}
          handleChange={handleChange}
          handleDiscard={handleDiscard}
          handleCancel={handleCancel}
          submitting={submitting}
        />
      </div>
    </div>
  );
};

export default AuditDetailPanel;
