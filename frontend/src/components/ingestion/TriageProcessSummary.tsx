import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, UserCheck, ArrowRight, Upload, ClipboardCheck } from 'lucide-react';
import PriorityBadge from '../common/PriorityBadge';
import type { N8nIngestResponse, N8nPerson } from '../../types/ingestion';

interface TriageProcessSummaryProps {
  response: N8nIngestResponse;
  onReset: () => void;
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
    <span className="text-[10px] text-slate-500 uppercase font-semibold">{label}</span>
    <div className="font-semibold text-slate-200 mt-1 text-xs wrap-break-word">{children}</div>
  </div>
);

const personName = (person?: N8nPerson | null) => person?.nome || person?.nombre || '-';

const TriageProcessSummary = ({ response, onReset }: TriageProcessSummaryProps) => {
  const navigate = useNavigate();
  const clinicalData = response.datos_extraidos ?? response.datos_generales;
  const paciente = clinicalData?.paciente;
  const clasificacion = response.clasificacion;
  const routing = response.decision_enrutamiento;
  const score = clasificacion?.score_confianza_clasificacion;

  const isPending = response.status === 'PENDIENTE_AUDITORIA' || Boolean(routing?.requiere_auditoria_humana);
  const isDiscarded = response.status === 'DESCARTADO' || response.status === 'error';

  return (
    <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Triaje clínico completado</h3>
          <p className="text-xs text-slate-400">Documento {response.documento_id || '-'}</p>
        </div>
      </div>

      {isPending && (
        <div
          role="status"
          className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium"
        >
          <UserCheck className="w-4 h-4 shrink-0" />
          Requiere auditoría humana antes de su derivación definitiva.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Tipo de documento">{clasificacion?.tipo_documento || '-'}</Field>
        <Field label="Prioridad">
          {clasificacion?.nivel_prioridad ? <PriorityBadge prioridad={clasificacion.nivel_prioridad} /> : '-'}
        </Field>
        <Field label="Confianza de clasificación">
          {typeof score === 'number' ? `${Math.round(score * 100)}%` : '-'}
        </Field>
        <Field label="Paciente">
          {personName(paciente)}
          {paciente?.rut && <span className="block text-slate-400 font-normal">{paciente.rut}</span>}
        </Field>
        <Field label="Médico solicitante">{personName(clinicalData?.medico_solicitante)}</Field>
        <Field label="Diagnóstico principal">{clinicalData?.diagnostico_principal || '-'}</Field>
        <Field label="Cola de destino">{routing?.destino_principal || '-'}</Field>
        <div className="sm:col-span-2">
          <Field label="Justificación del enrutamiento">{routing?.justificacion_enrutamiento || '-'}</Field>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-3 border-t border-slate-800/80">
        <button
          type="button"
          onClick={onReset}
          className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>{isDiscarded ? 'Reintentar subida' : 'Subir otro documento'}</span>
        </button>

        {isPending ? (
          <button
            type="button"
            onClick={() => navigate('/auditoria')}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-amber-950/40"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>Ir a Auditar Caso</span>
          </button>
        ) : isDiscarded ? (
          <button
            type="button"
            onClick={() => navigate('/documentos')}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Volver a Documentos</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/documentos')}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/30 shadow-md shadow-emerald-950/40 transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Ver en Bandeja de Expedientes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default TriageProcessSummary;
