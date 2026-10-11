import { useState, type FormEvent } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useDocumentForms } from '../../hooks/useDocumentForms';
import { useClinicalForm, valoresDesdeDocumento } from '../../hooks/useClinicalForm';
import { documentService } from '../../services/documentService';
import type { DocumentDetailResponse } from '../../types/medical';
import { errorMessage } from '../../utils/errors';
import { createLogger } from '../../utils/logger';
import AuditClinicalForm from '../audit/AuditClinicalForm';

const log = createLogger('correccion');

const FORM_ID = 'correccion-form';

interface DocumentCorrectionPanelProps {
  detail: DocumentDetailResponse;
  onCancel: () => void;
  onSaved: () => void;
}

/**
 * Corrección de un documento PROCESADO o AUDITADO: el mismo formulario de la auditoría, precargado
 * con los valores vigentes. Cada corrección queda en el historial del documento.
 */
const DocumentCorrectionPanel = ({ detail, onCancel, onSaved }: DocumentCorrectionPanelProps) => {
  const { queues } = useCatalogs();
  const { forms, error: formsError } = useDocumentForms();
  const form = useClinicalForm(forms, valoresDesdeDocumento(detail, detail));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const problema = form.validar();
    if (problema) {
      setError(problema);
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await documentService.correctDocument(detail.documento_id, {
        ...form.valoresParaEnviar(),
        justificacion: form.notas,
      });
      log.info('Documento corregido', { documento_id: detail.documento_id });
      onSaved();
    } catch (err) {
      setError(errorMessage(err, 'No se pudo guardar la corrección'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="flex flex-col min-h-0 min-w-0 rounded-2xl bg-slate-900 border border-indigo-500/30 overflow-hidden">
      <div className="p-4 border-b border-slate-800/80 bg-slate-800/30 flex justify-between items-start gap-2">
        <div>
          <h3 className="text-base font-bold text-white">Corregir documento</h3>
          <p className="text-xs text-slate-400">
            Los cambios se validan igual que en auditoría y quedan en el historial con tu justificación.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancelar corrección"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <AuditClinicalForm
        formId={FORM_ID}
        forms={forms}
        formsError={formsError}
        queues={queues}
        error={error}
        clasificacion={form.clasificacion}
        datosGenerales={form.datosGenerales}
        detalle={form.detalle}
        auditNotes={form.notas}
        onClasificacionChange={form.handleClasificacionChange}
        onDatosGeneralesChange={form.setDatosGenerales}
        onDetalleChange={form.setCampoDetalle}
        onAuditNotesChange={form.setNotas}
        handleResolve={(e) => void guardar(e)}
      />

      <div className="p-4 border-t border-slate-800/80 bg-slate-900 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={guardando}
          className="px-4 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-white bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          form={FORM_ID}
          // Sin los esquemas de formularios no se puede armar el detalle del tipo: se espera a que carguen.
          disabled={guardando || !forms}
          className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
        >
          {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Guardar corrección
        </button>
      </div>
    </div>
  );
};

export default DocumentCorrectionPanel;
