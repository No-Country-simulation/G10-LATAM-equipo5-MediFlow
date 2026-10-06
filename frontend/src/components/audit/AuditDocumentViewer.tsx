import { FileText, Download } from 'lucide-react';
import type { AuditDetailResponse } from '../../types/medical';

interface AuditDocumentViewerProps {
  detail: AuditDetailResponse | null;
}

const AuditDocumentViewer = ({ detail }: AuditDocumentViewerProps) => {
  return (
    <div className="flex flex-col rounded-2xl bg-slate-900/50 border border-slate-800 overflow-hidden">
      <div className="p-3 border-b border-slate-800/80 bg-slate-900 flex justify-between items-center">
        <div className="text-sm font-bold text-white flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-400" />
          Documento Original
        </div>
      </div>
      <div className="flex-1 p-2 overflow-auto bg-slate-950 flex flex-col items-center">
        {detail?.archivos?.map((archivo, i) => (
          <div key={i} className="w-full mb-4 border border-slate-800 rounded-lg overflow-hidden">
            <div className="bg-slate-900 px-3 py-2 text-xs font-mono text-slate-400 flex justify-between">
              <span>{archivo.tipo_archivo}</span>
              {!archivo.visualizable && (
                <a href={archivo.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-emerald-400 hover:underline">
                  <Download className="w-3 h-3" /> Descargar
                </a>
              )}
            </div>
            {archivo.visualizable ? (
              <iframe src={archivo.url} className="w-full h-[60vh]" title="Document Viewer" />
            ) : (
              <div className="p-10 text-center text-slate-500 text-sm">
                Este archivo no es visualizable en el navegador.
              </div>
            )}
          </div>
        ))}
        {(!detail?.archivos || detail.archivos.length === 0) && detail?.oci_preview_url && (
          <iframe src={detail.oci_preview_url} className="w-full h-full min-h-[60vh]" title="Document Viewer" />
        )}
      </div>
    </div>
  );
};

export default AuditDocumentViewer;
