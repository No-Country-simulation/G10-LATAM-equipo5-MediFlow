import type { DocumentListItemResponse } from '../../types/medical';
import PriorityBadge from '../common/PriorityBadge';

interface TriageCaseCardProps {
  doc: DocumentListItemResponse;
}

interface DestinationConfig {
  label: string;
  badge: string;
}

const DESTINATION_CONFIG: Record<string, DestinationConfig> = {
  Cola_Emergencia_Medica: {
    label: 'Urgencias Médicas',
    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  },
  Cola_Oncologia: {
    label: 'Comité Oncológico',
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
  Gestion_Procedimientos: {
    label: 'Quirófano / Procedimientos',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  Gestion_Interconsultas: {
    label: 'Interconsultas y Derivaciones',
    badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  },
};

const TriageCaseCard = ({ doc }: TriageCaseCardProps) => {
  const destination = doc.destino_enrutamiento
    ? (DESTINATION_CONFIG[doc.destino_enrutamiento] ?? {
        label: doc.destino_enrutamiento,
        badge: 'bg-slate-800 text-slate-300 border-slate-700',
      })
    : { label: 'Derivación Asistencial', badge: 'bg-slate-800 text-slate-300 border-slate-700' };

  const docCode = doc.documento_id.startsWith('DOC-')
    ? doc.documento_id
    : `DOC-CLIN-${doc.documento_id.slice(0, 8).toUpperCase()}`;

  const clinicalDiagnosis = doc.diagnostico_principal || doc.tipo_documento || 'Sin diagnóstico especificado';

  return (
    <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-3 shadow-md">
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-slate-200">
            {doc.nombre_paciente || 'Paciente sin identificar'}
          </span>
          <PriorityBadge prioridad={doc.nivel_prioridad} />
        </div>
        <p className="text-xs text-slate-400 font-mono mt-0.5">
          RUT: {doc.rut_paciente || 'N/A'} • {docCode}
        </p>
      </div>

      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs">
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
          Diagnóstico Clínico:
        </span>
        <span className="font-medium text-slate-200 line-clamp-2 mt-0.5 block">
          {clinicalDiagnosis}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/50">
        <span className="text-slate-400">Destino Clínico:</span>
        <span className={`px-2.5 py-0.5 rounded-md border font-medium text-[11px] ${destination.badge}`}>
          {destination.label}
        </span>
      </div>
    </div>
  );
};

export default TriageCaseCard;
