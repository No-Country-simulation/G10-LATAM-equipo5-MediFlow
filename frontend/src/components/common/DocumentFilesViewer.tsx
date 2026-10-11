import { FileText, Download, ExternalLink, AlertTriangle } from 'lucide-react';
import type { ArchivoDocumento } from '../../types/medical';

interface DocumentFilesViewerProps {
  archivos: ArchivoDocumento[];
  /** URL a mostrar si el documento no trae lista de archivos (respuestas antiguas de auditoría). */
  fallbackUrl?: string | null;
  /** Aviso del backend cuando OCI no pudo generar alguna URL. */
  aviso?: string | null;
  /** Minutos de vigencia de las URLs pre-firmadas. */
  expiraEnMinutos?: number;
}

const ENLACE = 'flex items-center gap-1 text-emerald-400 hover:underline';

/** Archivos originales de un documento, abiertos con su URL pre-firmada de solo lectura. */
const DocumentFilesViewer = ({ archivos, fallbackUrl, aviso, expiraEnMinutos }: DocumentFilesViewerProps) => (
  <div className="flex flex-col min-h-0 min-w-0 rounded-2xl bg-slate-900/50 border border-slate-800 overflow-hidden">
    <div className="p-3 border-b border-slate-800/80 bg-slate-900 flex justify-between items-center gap-2">
      <div className="text-sm font-bold text-white flex items-center gap-2">
        <FileText className="w-4 h-4 text-slate-400" />
        Documento Original
      </div>
      {expiraEnMinutos ? (
        <span className="text-[10px] text-slate-500">Enlace válido por {expiraEnMinutos} min</span>
      ) : null}
    </div>
    <div className="flex-1 min-h-0 p-2 overflow-y-auto overflow-x-hidden bg-slate-950 flex flex-col items-center">
      {aviso && (
        <div role="alert" className="w-full mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}
      {archivos.map((archivo) => (
        <div key={archivo.orden} className="w-full mb-4 border border-slate-800 rounded-lg overflow-hidden">
          <div className="bg-slate-900 px-3 py-2 text-xs font-mono text-slate-400 flex justify-between gap-2">
            <span className="truncate">
              {archivo.tipo_archivo}
              {archivo.rol ? ` · ${archivo.rol}` : ''}
            </span>
            {archivo.url && (
              <a href={archivo.url} target="_blank" rel="noreferrer" className={ENLACE}>
                {archivo.visualizable ? <ExternalLink className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                {archivo.visualizable ? 'Abrir' : 'Descargar'}
              </a>
            )}
          </div>
          {archivo.url && archivo.visualizable ? (
            <iframe src={archivo.url} className="w-full h-[60vh]" title={`Documento original ${archivo.orden}`} />
          ) : (
            <div className="p-10 text-center text-slate-500 text-sm">
              {archivo.url ? 'Este archivo no es visualizable en el navegador.' : 'Archivo no disponible por ahora.'}
            </div>
          )}
        </div>
      ))}
      {archivos.length === 0 && fallbackUrl && (
        <iframe src={fallbackUrl} className="w-full h-full min-h-[60vh]" title="Documento original" />
      )}
      {archivos.length === 0 && !fallbackUrl && !aviso && (
        <div className="p-10 text-center text-slate-500 text-sm">El documento no tiene archivos asociados.</div>
      )}
    </div>
  </div>
);

export default DocumentFilesViewer;
