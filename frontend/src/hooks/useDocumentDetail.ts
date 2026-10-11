import { useCallback, useEffect, useState } from 'react';
import { documentService } from '../services/documentService';
import type { DocumentDetailResponse } from '../types/medical';
import { createLogger, describeError } from '../utils/logger';

const log = createLogger('detalle-documento');

interface Resultado {
  clave: string;
  detail: DocumentDetailResponse | null;
  error: string | null;
}

/**
 * Detalle de un documento (`GET /documents/{id}`); con `documentoId` en `null` no pide nada.
 * El resultado guarda a qué pedido corresponde (documento + recarga): mientras no coincida con el
 * actual, está cargando. `recargar` vuelve a pedirlo (por ejemplo, después de corregirlo).
 */
export const useDocumentDetail = (documentoId: string | null) => {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [recargas, setRecargas] = useState(0);
  const clave = documentoId ? `${documentoId}#${recargas}` : null;

  useEffect(() => {
    if (!documentoId || !clave) return;
    let cancelled = false;

    documentService
      .getDocumentDetail(documentoId)
      .then((detail) => {
        if (cancelled) return;
        if (detail.aviso_archivos) log.warn('Detalle sin todas las URLs de archivos', { documento_id: documentoId });
        setResultado({ clave, detail, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        log.error('No se pudo cargar el detalle', { documento_id: documentoId, error: describeError(err) });
        const error = err instanceof Error ? err.message : 'No se pudo cargar el detalle del documento';
        setResultado({ clave, detail: null, error });
      });

    return () => {
      cancelled = true;
    };
  }, [documentoId, clave]);

  const recargar = useCallback(() => setRecargas((n) => n + 1), []);
  const vigente = clave && resultado?.clave === clave ? resultado : null;
  // Mientras se recarga el mismo documento se sigue mostrando la versión anterior (sin parpadeo).
  const anterior = documentoId && resultado?.clave.startsWith(`${documentoId}#`) ? resultado : null;
  return {
    detail: (vigente ?? anterior)?.detail ?? null,
    error: vigente?.error ?? null,
    loading: Boolean(clave) && !vigente,
    recargar,
  };
};
