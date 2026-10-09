import type { ChangeEvent, FormEvent } from 'react';
import type { AuditDetailResponse, NivelPrioridad } from '../../types/medical';
import type { QueueActiveForLLM, DocumentTypeActiveForLLM } from '../../types/catalog';

interface FormData {
  rut_paciente: string;
  nombre_paciente: string;
  edad_paciente: string | number;
  medico_nombre: string;
  medico_rut: string;
  tipo_documento: string;
  nivel_prioridad: NivelPrioridad;
  diagnostico_principal: string;
  cie10_sugerido: string;
  destino_enrutamiento: string;
  especialidad: string;
  audit_notes: string;
}

interface AuditClinicalFormProps {
  formData: FormData;
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  handleResolve: (e: FormEvent) => void;
  documentTypes: DocumentTypeActiveForLLM[];
  queues: QueueActiveForLLM[];
  detail: AuditDetailResponse | null;
  error: string | null;
}

const AuditClinicalForm = ({
  formData,
  handleChange,
  handleResolve,
  documentTypes,
  queues,
  detail,
  error,
}: AuditClinicalFormProps) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
          {error}
        </div>
      )}

      {detail?.motivos_auditoria?.length ? (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
          <span className="font-bold text-amber-400 mb-1 block">Motivos de Auditoría:</span>
          <ul className="list-disc pl-4 text-amber-300/80 space-y-0.5">
            {detail.motivos_auditoria.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      ) : null}

      <form id="audit-form" onSubmit={handleResolve} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">RUT Paciente</label>
            <input type="text" name="rut_paciente" value={formData.rut_paciente} onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Nombre Paciente</label>
            <input type="text" name="nombre_paciente" value={formData.nombre_paciente} onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Tipo Documento</label>
            <select name="tipo_documento" value={formData.tipo_documento} onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white">
              {documentTypes.map(t => <option key={t.codigo} value={t.codigo}>{t.nombre}</option>)}
              <option value="OTRO">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Destino Hospitalario</label>
            <select name="destino_enrutamiento" value={formData.destino_enrutamiento} onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white">
              {queues.map(q => <option key={q.codigo} value={q.codigo}>{q.nombre}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Diagnóstico Principal</label>
            <input type="text" name="diagnostico_principal" value={formData.diagnostico_principal} onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Prioridad Clínica</label>
            <select name="nivel_prioridad" value={formData.nivel_prioridad} onChange={handleChange} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white">
              <option value="Urgente">Urgente</option>
              <option value="Prioritario">Prioritario</option>
              <option value="Rutina">Rutina</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Notas de Auditoría (Obligatorio)</label>
          <textarea
            name="audit_notes"
            value={formData.audit_notes}
            onChange={handleChange}
            placeholder="Justifique las correcciones realizadas..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white min-h-24"
            required
          />
        </div>
      </form>
    </div>
  );
};

export default AuditClinicalForm;
