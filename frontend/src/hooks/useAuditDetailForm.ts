import { useState, useEffect } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { documentService } from '../services/documentService';
import type { AuditDetailResponse } from '../types/medical';
import type { DocumentForms } from '../types/forms';
import { useClinicalForm, valoresDesdeDocumento } from './useClinicalForm';
import { errorMessage } from '../utils/errors';
import { createLogger, describeError } from '../utils/logger';

export type { ClasificacionForm } from './useClinicalForm';

const log = createLogger('auditoria');

/**
 * Formulario de auditoría: carga el caso, y lo resuelve o descarta. El estado de los campos
 * clínicos es el mismo de la corrección de documentos (`useClinicalForm`).
 */
export const useAuditDetailForm = (documentId: string, onClose: () => void, forms: DocumentForms | null) => {
  const [detail, setDetail] = useState<AuditDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [motivoDescarte, setMotivoDescarte] = useState('');

  const form = useClinicalForm(forms);
  const { cargar } = form;

  useEffect(() => {
    let cancelled = false;
    documentService
      .getAuditDetail(documentId)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        cargar(valoresDesdeDocumento(data, data.raw_extracted_json));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err, 'Error al cargar el detalle'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, cargar]);

  const handleMotivoChange = (e: ChangeEvent<HTMLTextAreaElement>) => setMotivoDescarte(e.target.value);

  const handleResolve = async (e: FormEvent) => {
    e.preventDefault();
    const problema = form.validar();
    if (problema) {
      setError(problema);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await documentService.resolveAudit(documentId, { ...form.valoresParaEnviar(), audit_notes: form.notas });
      log.info('Caso resuelto', { documentId, tipo: form.clasificacion.tipo_documento });
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Error al resolver el caso'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDiscard = async () => {
    if (!motivoDescarte.trim()) {
      setError('El motivo de descarte es obligatorio.');
      return;
    }
    setSubmitting(true);
    try {
      await documentService.discardAudit(documentId, { motivo: motivoDescarte });
      log.info('Caso descartado', { documentId });
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Error al descartar el caso'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    try {
      await documentService.releaseAuditCase(documentId);
    } catch (err) {
      log.warn('No se pudo liberar el caso al cancelar', { documentId, error: describeError(err) });
    }
    onClose();
  };

  return {
    detail,
    loading,
    error,
    submitting,
    clasificacion: form.clasificacion,
    datosGenerales: form.datosGenerales,
    detalle: form.detalle,
    auditNotes: form.notas,
    motivoDescarte,
    handleClasificacionChange: form.handleClasificacionChange,
    setDatosGenerales: form.setDatosGenerales,
    setCampoDetalle: form.setCampoDetalle,
    setAuditNotes: form.setNotas,
    handleMotivoChange,
    handleResolve,
    handleDiscard,
    handleCancel,
  };
};
