import { createContext, useContext } from 'react';

export interface DocumentDetailContextValue {
  /** Abre el detalle del documento (original + datos) a pantalla completa. */
  abrirDocumento: (documentoId: string) => void;
  /** Avisa que un documento cambió (por ejemplo, tras corregirlo) para recargar los listados. */
  notificarCambio: () => void;
  /** Aumenta con cada cambio notificado; los listados lo usan como dependencia para recargar. */
  revision: number;
}

export const DocumentDetailContext = createContext<DocumentDetailContextValue | null>(null);

/** Acceso al modal de detalle de documento; requiere `DocumentDetailProvider` (está en `AppLayout`). */
export const useDocumentDetailModal = (): DocumentDetailContextValue => {
  const value = useContext(DocumentDetailContext);
  if (!value) throw new Error('useDocumentDetailModal debe usarse dentro de DocumentDetailProvider');
  return value;
};

/** Revisión de los documentos; 0 fuera del proveedor (los listados funcionan igual sin él). */
export const useRevisionDocumentos = (): number => useContext(DocumentDetailContext)?.revision ?? 0;
