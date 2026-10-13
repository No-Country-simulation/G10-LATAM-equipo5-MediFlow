import { Cloud } from 'lucide-react';

interface OciPathProps {
  path: string | null | undefined;
  className?: string;
}

/** Ruta del JSON del documento en OCI Object Storage (la carpeta indica dónde quedó: procesados,
 * auditoría humana, auditados...). Se recorta si no cabe; la ruta completa queda en el `title`. */
const OciPath = ({ path, className = '' }: OciPathProps) => {
  if (!path) return null;
  return (
    <div className={`flex items-center gap-1.5 min-w-0 text-slate-400 ${className}`} title={`OCI: ${path}`}>
      <Cloud className="w-3 h-3 shrink-0 text-sky-400" />
      <span className="font-mono text-[10px] truncate">OCI: {path}</span>
    </div>
  );
};

export default OciPath;
