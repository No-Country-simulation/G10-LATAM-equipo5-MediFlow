import type { ReactNode } from 'react';
import { CheckCircle2, UserCheck } from 'lucide-react';
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
  const clinicalData = response.datos_extraidos ?? response.datos_generales;
  const paciente = clinicalData?.paciente;
  const clasificacion = response.clasificacion;
  const routing = response.decision_enrutamiento;
  const score = clasificacion?.score_confianza_clasificacion;

  return (
    <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Triaje clínico completado</h3>
            <p className="text-xs text-slate-400">Documento {response.documento_id || '-'}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 transition-colors cursor-pointer"
        >
          Procesar otro documento
        </button>
      </div>

      {routing?.requiere_auditoria_humana && (
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
          {clasificacion?.nivel_prioridad ? (
            <PriorityBadge prioridad={clasificacion.nivel_prioridad} />
          ) : (
            '-'
          )}
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
          <Field label="Justificación del enrutamiento">
            {routing?.justificacion_enrutamiento || '-'}
          </Field>
        </div>
      </div>
    </div>
  );
};

export default TriageProcessSummary;
