import { Copy, Eye } from 'lucide-react';
import type { CoincidenciaArchivo } from '../../types/medical';
import { useDocumentDetailModal } from '../../context/documentDetailContext';
import { etiquetaDeCodigo } from '../../utils/etiquetas';

const formatoFecha = (iso: string): string => {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime())
    ? iso
    : fecha.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const Coincidencia = ({ coincidencia }: { coincidencia: CoincidenciaArchivo }) => {
  const { abrirDocumento } = useDocumentDetailModal();
  const fecha = formatoFecha(coincidencia.created_at);
  const { documento_id: documentoId, estado, area_origen: area } = coincidencia;

  if (!documentoId) {
    // Documento de otro usuario que este rol no puede abrir: solo área y fecha.
    return <li>Ya lo subió {area ? `el área ${area}` : 'otra área'} el {fecha}.</li>;
  }
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>
        Ya se subió el {fecha} como <span className="font-mono font-semibold">{documentoId}</span>
        {estado ? ` (${etiquetaDeCodigo(estado).toLowerCase()})` : ''}
        {area ? ` desde ${area}` : ''}.
      </span>
      <button
        type="button"
        onClick={() => abrirDocumento(documentoId)}
        className="inline-flex items-center gap-1 text-amber-200 underline-offset-2 hover:underline cursor-pointer"
      >
        <Eye className="w-3.5 h-3.5" />
        Ver documento
      </button>
    </li>
  );
};

/** Aviso de que el archivo elegido ya fue subido antes (misma huella SHA-256). */
const DuplicateFileWarning = ({ coincidencias }: { coincidencias: CoincidenciaArchivo[] }) => (
  <div role="alert" className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1.5">
    <p className="font-semibold flex items-center gap-1.5 text-amber-200">
      <Copy className="w-4 h-4 shrink-0" />
      Este archivo ya fue subido antes
    </p>
    <ul className="space-y-1 break-words">
      {coincidencias.map((c) => (
        <Coincidencia key={`${c.documento_id ?? 'ajeno'}-${c.created_at}`} coincidencia={c} />
      ))}
    </ul>
    <p className="text-amber-300/80">
      Si lo subes igual, quedará en auditoría como posible duplicado para que alguien lo revise.
    </p>
  </div>
);

export default DuplicateFileWarning;
