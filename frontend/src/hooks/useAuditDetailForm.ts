import { useState, useEffect } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { documentService } from '../services/documentService';
import type { AuditDetailResponse, DatosGenerales, NivelPrioridad } from '../types/medical';
import type { DocumentForms, JsonObject, JsonValue } from '../types/forms';
import { datosGeneralesDesdeJson, detalleParaTipo, validarAuditoria } from '../utils/auditForm';
import { errorMessage } from '../utils/errors';
import { createLogger, describeError } from '../utils/logger';

const log = createLogger('auditoria');

export interface ClasificacionForm {
  tipo_documento: string;
  nivel_prioridad: NivelPrioridad;
  destino_enrutamiento: string;
  especialidad: string;
}

const CLASIFICACION_VACIA: ClasificacionForm = {
  tipo_documento: '',
  nivel_prioridad: 'Rutina',
  destino_enrutamiento: '',
  especialidad: '',
};

/**
 * Estado del formulario de auditoría. Usa la misma estructura que la ingesta (`datos_generales` y
 * `detalle_clinico`): el auditor corrige exactamente lo que extrajo la IA, con los campos del tipo
 * elegido (ver GET /catalogs/document-types/forms).
 */
export const useAuditDetailForm = (documentId: string, onClose: () => void, forms: DocumentForms | null) => {
  const [detail, setDetail] = useState<AuditDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [clasificacion, setClasificacion] = useState<ClasificacionForm>(CLASIFICACION_VACIA);
  const [datosGenerales, setDatosGenerales] = useState<JsonObject>({});
  const [detalle, setDetalle] = useState<JsonObject>({});
  const [auditNotes, setAuditNotes] = useState('');
  const [motivoDescarte, setMotivoDescarte] = useState('');

  useEffect(() => {
    let cancelled = false;
    documentService
      .getAuditDetail(documentId)
      .then((data) => {
        if (cancelled) return;
        const raw = data.raw_extracted_json ?? {};
        setDetail(data);
        setClasificacion({
          tipo_documento: data.tipo_documento,
          nivel_prioridad: data.nivel_prioridad,
          destino_enrutamiento: data.destino_enrutamiento || '',
          especialidad: data.especialidad || '',
        });
        setDatosGenerales(datosGeneralesDesdeJson(raw));
        setDetalle((raw.detalle_clinico as JsonObject | undefined) ?? {});
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
  }, [documentId]);

  const handleClasificacionChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setClasificacion((prev) => ({ ...prev, [name]: value }));
    // Al cambiar de tipo cambian sus campos: el bloque del tipo anterior se descarta.
    if (name === 'tipo_documento') setDetalle((prev) => detalleParaTipo(prev, value, forms));
  };

  const setCampoDetalle = (bloque: string, valor: JsonValue) => setDetalle((prev) => ({ ...prev, [bloque]: valor }));

  const handleMotivoChange = (e: ChangeEvent<HTMLTextAreaElement>) => setMotivoDescarte(e.target.value);

  const handleResolve = async (e: FormEvent) => {
    e.preventDefault();
    const problema = validarAuditoria(datosGenerales, auditNotes);
    if (problema) {
      setError(problema);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await documentService.resolveAudit(documentId, {
        tipo_documento: clasificacion.tipo_documento,
        nivel_prioridad: clasificacion.nivel_prioridad,
        destino_enrutamiento: clasificacion.destino_enrutamiento,
        especialidad: clasificacion.especialidad || null,
        datos_generales: datosGenerales as unknown as DatosGenerales,
        detalle_clinico: detalleParaTipo(detalle, clasificacion.tipo_documento, forms),
        audit_notes: auditNotes,
      });
      log.info('Caso resuelto', { documentId, tipo: clasificacion.tipo_documento });
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
    clasificacion,
    datosGenerales,
    detalle,
    auditNotes,
    motivoDescarte,
    handleClasificacionChange,
    setDatosGenerales,
    setCampoDetalle,
    setAuditNotes,
    handleMotivoChange,
    handleResolve,
    handleDiscard,
    handleCancel,
  };
};
