import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, UserCheck, ArrowRight, Upload, ClipboardCheck, Eye } from 'lucide-react';
import PriorityBadge from '../common/PriorityBadge';
import type { N8nIngestResponse, N8nProfesional } from '../../types/ingestion';
import { formatIdentificacion } from '../../utils/identificacion';
import { useDocumentDetailModal } from '../../context/documentDetailContext';

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

// Quien informa o atiende el documento antes que quien lo pidió (mismo criterio que el backend).
const ROLES_RESPONSABLE = ['INFORMANTE', 'TRATANTE', 'SOLICITANTE'];

const indiceRol = (rol?: string | null) => {
  const indice = ROLES_RESPONSABLE.indexOf(rol ?? '');
  return indice === -1 ? ROLES_RESPONSABLE.length : indice;
};

const responsable = (profesionales?: N8nProfesional[] | null) => {
  const conNombre = (profesionales ?? []).filter((p) => p.nombre);
  return [...conNombre].sort((a, b) => indiceRol(a.rol) - indiceRol(b.rol))[0]?.nombre || '-';
};

const TriageProcessSummary = ({ response, onReset }: TriageProcessSummaryProps) => {
  const navigate = useNavigate();
  const { abrirDocumento } = useDocumentDetailModal();
  const clinicalData = response.datos_generales ?? response.datos_extraidos;
  const paciente = clinicalData?.paciente;
  const diagnosticos = clinicalData?.diagnosticos ?? [];
  const principal = diagnosticos.find((d) => d.tipo === 'PRINCIPAL') ?? diagnosticos[0];
  const clasificacion = response.clasificacion;
  const routing = response.decision_enrutamiento;
  // El score final lo calcula el backend; el que reporta la IA queda solo como respaldo.
  const score = response.score_confianza ?? clasificacion?.score_confianza_clasificacion ?? undefined;
  const ficha = paciente?.numero_ficha ? ` · Ficha ${paciente.numero_ficha}` : '';

  const isPending = response.status === 'PENDIENTE_AUDITORIA' || Boolean(routing?.requiere_auditoria_humana);
  const documentoId = response.documento_id;
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
          {paciente?.nombre || '-'}
          <span className="block text-slate-400 font-normal">
            {formatIdentificacion(paciente?.identificacion?.numero, paciente?.identificacion?.tipo, '')}
            {ficha}
          </span>
        </Field>
        <Field label="Profesional">{responsable(clinicalData?.profesionales)}</Field>
        <Field label="Diagnóstico principal">
          {principal?.descripcion || '-'}
          {principal?.cie10 && <span className="block text-slate-400 font-normal font-mono">CIE-10 {principal.cie10}</span>}
        </Field>
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

        {!isDiscarded && documentoId && (
          <button
            type="button"
            onClick={() => abrirDocumento(documentoId)}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Ver detalle</span>
          </button>
        )}

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
