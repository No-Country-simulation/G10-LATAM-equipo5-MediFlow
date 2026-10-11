import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { DocumentDetailContext } from '../../context/documentDetailContext';
import DocumentDetailModal from './DocumentDetailModal';

/** Un único modal de detalle para toda la app: cualquier listado lo abre con `abrirDocumento(id)`. */
const DocumentDetailProvider = ({ children }: { children: ReactNode }) => {
  const [documentoAbierto, setDocumentoAbierto] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const cerrar = useCallback(() => setDocumentoAbierto(null), []);
  const notificarCambio = useCallback(() => setRevision((n) => n + 1), []);
  const value = useMemo(
    () => ({ abrirDocumento: setDocumentoAbierto, notificarCambio, revision }),
    [notificarCambio, revision]
  );

  return (
    <DocumentDetailContext.Provider value={value}>
      {children}
      {documentoAbierto && <DocumentDetailModal documentoId={documentoAbierto} onClose={cerrar} />}
    </DocumentDetailContext.Provider>
  );
};

export default DocumentDetailProvider;
