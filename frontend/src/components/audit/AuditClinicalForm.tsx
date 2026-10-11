import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import type { AuditDetailResponse } from '../../types/medical';
import type { QueueActiveForLLM } from '../../types/catalog';
import type { DocumentForms, JsonObject, JsonValue } from '../../types/forms';
import type { ClasificacionForm } from '../../hooks/useAuditDetailForm';
import { SchemaField } from '../common/schema-form/SchemaField';

interface AuditClinicalFormProps {
  forms: DocumentForms | null;
  formsError: string | null;
  queues: QueueActiveForLLM[];
  detail: AuditDetailResponse | null;
  error: string | null;
  clasificacion: ClasificacionForm;
  datosGenerales: JsonObject;
  detalle: JsonObject;
  auditNotes: string;
  onClasificacionChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onDatosGeneralesChange: (valor: JsonObject) => void;
  onDetalleChange: (bloque: string, valor: JsonValue) => void;
  onAuditNotesChange: (valor: string) => void;
  handleResolve: (e: FormEvent) => void;
}

const INPUT = 'w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white';
const LABEL = 'block text-[11px] font-semibold text-slate-400 uppercase mb-1';
const PRIORIDADES = ['Urgente', 'Prioritario', 'Rutina'] as const;

const Seccion = ({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children: ReactNode }) => (
  <section className="space-y-3 pt-4 border-t border-slate-800/80 first:border-t-0 first:pt-0">
    <div>
      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide">{titulo}</h4>
      {descripcion && <p className="text-[11px] text-slate-500">{descripcion}</p>}
    </div>
    {children}
  </section>
);

/**
 * Formulario de corrección. Los campos del paciente, los diagnósticos y los de cada tipo de
 * documento se dibujan desde los esquemas del backend: al elegir otro tipo, cambian sus campos.
 */
const AuditClinicalForm = ({
  forms,
  formsError,
  queues,
  detail,
  error,
  clasificacion,
  datosGenerales,
  detalle,
  auditNotes,
  onClasificacionChange,
  onDatosGeneralesChange,
  onDetalleChange,
  onAuditNotesChange,
  handleResolve,
}: AuditClinicalFormProps) => {
  const tipo = forms?.tipos.find((t) => t.codigo === clasificacion.tipo_documento);
  const tipoDesconocido = Boolean(forms) && !tipo && clasificacion.tipo_documento;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
      {(error || formsError) && (
        <div role="alert" className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
          {error || formsError}
        </div>
      )}

      {detail?.motivos_auditoria?.length ? (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
          <span className="font-bold text-amber-400 mb-1 block">Motivos de Auditoría:</span>
          <ul className="list-disc pl-4 text-amber-300/80 space-y-0.5">
            {detail.motivos_auditoria.map((motivo) => <li key={motivo}>{motivo}</li>)}
          </ul>
        </div>
      ) : null}

      <form id="audit-form" onSubmit={handleResolve} className="space-y-5">
        <Seccion titulo="Clasificación">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="audit-tipo" className={LABEL}>Tipo de documento</label>
              <select id="audit-tipo" name="tipo_documento" value={clasificacion.tipo_documento} onChange={onClasificacionChange} className={INPUT}>
                {tipoDesconocido && <option value={clasificacion.tipo_documento}>{clasificacion.tipo_documento} (no está en el catálogo)</option>}
                {forms?.tipos.map((t) => <option key={t.codigo} value={t.codigo}>{t.nombre}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="audit-destino" className={LABEL}>Destino</label>
              <select id="audit-destino" name="destino_enrutamiento" value={clasificacion.destino_enrutamiento} onChange={onClasificacionChange} className={INPUT}>
                {queues.map((q) => <option key={q.codigo} value={q.codigo}>{q.nombre}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="audit-prioridad" className={LABEL}>Prioridad clínica</label>
              <select id="audit-prioridad" name="nivel_prioridad" value={clasificacion.nivel_prioridad} onChange={onClasificacionChange} className={INPUT}>
                {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="audit-especialidad" className={LABEL}>Especialidad</label>
              <input id="audit-especialidad" name="especialidad" value={clasificacion.especialidad} onChange={onClasificacionChange} maxLength={150} className={INPUT} />
            </div>
          </div>
        </Seccion>

        {forms && (
          <>
            <Seccion titulo="Paciente y documento" descripcion="La identificación se valida (dígito verificador del RUT, CPF, DNI español) y el CIE-10 debe tener formato válido.">
              <SchemaField
                schema={forms.datos_generales}
                value={datosGenerales}
                onChange={(valor) => onDatosGeneralesChange(valor as JsonObject)}
                path="datos_generales"
              />
            </Seccion>

            <Seccion titulo={`Campos de ${tipo?.nombre ?? 'este tipo'}`}>
              {tipo?.bloque && tipo.esquema ? (
                <SchemaField
                  schema={tipo.esquema}
                  value={detalle[tipo.bloque]}
                  onChange={(valor) => onDetalleChange(tipo.bloque as string, valor)}
                  path={`detalle.${tipo.bloque}`}
                />
              ) : (
                <p className="text-[11px] text-slate-500 italic">Este tipo no tiene campos propios; usa las listas de abajo.</p>
              )}
            </Seccion>

            {Object.entries(forms.comunes).map(([lista, esquema]) => (
              <Seccion key={lista} titulo={esquema.title ?? lista}>
                <SchemaField schema={{ ...esquema, title: undefined }} value={detalle[lista]} onChange={(valor) => onDetalleChange(lista, valor)} path={`detalle.${lista}`} label={esquema.title} />
              </Seccion>
            ))}
          </>
        )}

        <Seccion titulo="Notas de auditoría">
          <label htmlFor="audit-notas" className="sr-only">Notas de auditoría (obligatorio)</label>
          <textarea
            id="audit-notas"
            value={auditNotes}
            onChange={(e) => onAuditNotesChange(e.target.value)}
            placeholder="Justifique las correcciones realizadas (obligatorio)..."
            className={`${INPUT} min-h-24`}
            required
          />
        </Seccion>
      </form>
    </div>
  );
};

export default AuditClinicalForm;
