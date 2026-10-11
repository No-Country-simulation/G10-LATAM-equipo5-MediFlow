import type { ReactNode } from 'react';
import type { DocumentDetailResponse } from '../../types/medical';
import { formatIdentificacion } from '../../utils/identificacion';
import { etiquetaDeCodigo, textoDeValor } from '../../utils/etiquetas';
import DocumentCorrectionHistory from './DocumentCorrectionHistory';
import PossibleDuplicatesNotice from './PossibleDuplicatesNotice';

const ETIQUETA = 'text-[10px] font-semibold text-slate-500 uppercase';

const unir = (...partes: (string | null | undefined)[]) => partes.filter(Boolean).join(' · ');

const Seccion = ({ titulo, children }: { titulo: string; children: ReactNode }) => (
  <section className="space-y-2 pt-4 border-t border-slate-800/80 first:border-t-0 first:pt-0">
    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide">{titulo}</h4>
    {children}
  </section>
);

const Dato = ({ etiqueta, valor }: { etiqueta: string; valor: unknown }) => (
  <div className="min-w-0">
    <dt className={ETIQUETA}>{etiqueta}</dt>
    <dd className="text-xs text-slate-200 break-words whitespace-pre-line">{textoDeValor(valor)}</dd>
  </div>
);

const Datos = ({ children }: { children: ReactNode }) => (
  <dl className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">{children}</dl>
);

const Tarjeta = ({ children }: { children: ReactNode }) => (
  <li className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 break-words">{children}</li>
);

const claseParametro = (critico: boolean | null, alterado: boolean | null): string => {
  if (critico) return 'text-rose-300';
  if (alterado) return 'text-amber-300';
  return 'text-slate-300';
};

const marcaParametro = (critico: boolean | null, alterado: boolean | null): string => {
  if (critico) return ' (crítico)';
  if (alterado) return ' *';
  return '';
};

const DetalleClinico = ({ detail }: { detail: DocumentDetailResponse }) => {
  const { tablas, campos_relevantes: campos } = detail.detalle;

  return (
    <>
      {tablas.diagnosticos.length > 0 && (
        <Seccion titulo="Diagnósticos">
          <ul className="space-y-2">
            {tablas.diagnosticos.map((d, i) => (
              <Tarjeta key={`${d.cie10}-${i}`}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-slate-100">{d.descripcion ?? 'Sin descripción'}</span>
                  {d.cie10 && <span className="px-1.5 rounded bg-slate-800 font-mono text-[10px]">{d.cie10}</span>}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {unir(
                    etiquetaDeCodigo(d.tipo),
                    etiquetaDeCodigo(d.certeza),
                    d.origen_cie10 && `CIE-10: ${etiquetaDeCodigo(d.origen_cie10)}`
                  )}
                </div>
              </Tarjeta>
            ))}
          </ul>
        </Seccion>
      )}

      {campos.length > 0 && (
        <Seccion titulo="Contenido del documento">
          <dl className="space-y-3">
            {campos.map((c) => <Dato key={c.campo} etiqueta={c.etiqueta} valor={c.valor} />)}
          </dl>
        </Seccion>
      )}

      {tablas.paneles_laboratorio.map((panel, i) => (
        <Seccion key={`${panel.nombre_panel}-${i}`} titulo={unir(panel.nombre_panel ?? 'Laboratorio', panel.muestra)}>
          <table className="w-full table-fixed text-xs">
            <thead>
              <tr className={`${ETIQUETA} text-left`}>
                <th className="w-2/5 pb-1 font-semibold">Parámetro</th>
                <th className="pb-1 font-semibold">Resultado</th>
                <th className="w-1/3 pb-1 font-semibold">Referencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {panel.parametros.map((p, j) => (
                <tr key={`${p.nombre}-${j}`} className={claseParametro(p.critico, p.alterado)}>
                  <td className="py-1 pr-2 break-words align-top">{p.nombre ?? '—'}</td>
                  <td className="py-1 pr-2 break-words align-top font-semibold">
                    {[p.valor, p.unidad].filter(Boolean).join(' ') || '—'}
                    {marcaParametro(p.critico, p.alterado)}
                  </td>
                  <td className="py-1 break-words align-top text-slate-500">{p.rango_referencia ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Seccion>
      ))}

      {tablas.medicamentos.length > 0 && (
        <Seccion titulo="Medicamentos">
          <ul className="space-y-2">
            {tablas.medicamentos.map((m, i) => (
              <Tarjeta key={`${m.nombre}-${i}`}>
                <div className="font-semibold text-slate-100">{m.nombre ?? 'Sin nombre'}</div>
                <div className="text-[11px] text-slate-400">
                  {unir(m.dosis, m.frecuencia, m.via, m.duracion_tratamiento, m.cantidad && `Cantidad: ${m.cantidad}`)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">{etiquetaDeCodigo(m.tipo)}</div>
              </Tarjeta>
            ))}
          </ul>
        </Seccion>
      )}

      {tablas.examenes_solicitados.length > 0 && (
        <Seccion titulo="Exámenes solicitados">
          <ul className="space-y-2">
            {tablas.examenes_solicitados.map((e, i) => (
              <Tarjeta key={`${e.codigo}-${e.nombre}-${i}`}>
                <span className="font-semibold text-slate-100">{e.nombre ?? 'Sin nombre'}</span>
                <span className="text-[11px] text-slate-500"> · {unir(etiquetaDeCodigo(e.categoria), e.codigo)}</span>
              </Tarjeta>
            ))}
          </ul>
        </Seccion>
      )}

      {tablas.procedimientos.length > 0 && (
        <Seccion titulo="Procedimientos">
          <ul className="list-disc pl-4 text-xs text-slate-300 space-y-0.5">
            {tablas.procedimientos.map((p, i) => <li key={`${p}-${i}`} className="break-words">{p}</li>)}
          </ul>
        </Seccion>
      )}

      {tablas.profesionales.length > 0 && (
        <Seccion titulo="Profesionales">
          <ul className="space-y-2">
            {tablas.profesionales.map((p, i) => (
              <Tarjeta key={`${p.nombre}-${i}`}>
                <span className="font-semibold text-slate-100">{p.nombre ?? 'Sin nombre'}</span>
                <div className="text-[11px] text-slate-500">
                  {unir(
                    etiquetaDeCodigo(p.rol),
                    p.especialidad,
                    p.identificacion,
                    p.registro_profesional && `Reg. ${p.registro_profesional}`
                  )}
                </div>
              </Tarjeta>
            ))}
          </ul>
        </Seccion>
      )}
    </>
  );
};

/** Datos del documento para leer: paciente, documento, detalle clínico e historial de correcciones. */
const DocumentDetailContent = ({ detail }: { detail: DocumentDetailResponse }) => (
  <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-5 space-y-4">
    <PossibleDuplicatesNotice duplicados={detail.duplicados ?? []} />

    {detail.motivos_auditoria.length > 0 && (
      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
        <span className="font-bold text-amber-400 mb-1 block">Motivos de auditoría:</span>
        <ul className="list-disc pl-4 text-amber-300/80 space-y-0.5">
          {detail.motivos_auditoria.map((m) => <li key={m} className="break-words">{m}</li>)}
        </ul>
      </div>
    )}

    <Seccion titulo="Paciente">
      <Datos>
        <Dato etiqueta="Nombre" valor={detail.nombre_paciente} />
        <Dato etiqueta="Identificación" valor={formatIdentificacion(detail.identificacion_paciente, detail.tipo_identificacion, '')} />
        <Dato etiqueta="Edad" valor={detail.edad_paciente == null ? null : `${detail.edad_paciente} años`} />
        <Dato etiqueta="Sexo" valor={detail.sexo} />
        <Dato etiqueta="Fecha de nacimiento" valor={detail.fecha_nacimiento} />
        <Dato etiqueta="N° de ficha" valor={detail.numero_ficha} />
      </Datos>
    </Seccion>

    <Seccion titulo="Documento">
      <Datos>
        <Dato etiqueta="Institución" valor={detail.institucion_emisora} />
        <Dato etiqueta="Fecha" valor={detail.fecha_documento} />
        <Dato etiqueta="Especialidad" valor={detail.especialidad} />
        <Dato etiqueta="Médico" valor={detail.medico_nombre} />
        <Dato etiqueta="Área de origen" valor={detail.area_origen?.nombre} />
        <Dato etiqueta="Destino" valor={detail.destino_enrutamiento} />
        <Dato etiqueta="Confianza IA" valor={`${Math.round(detail.score_confianza * 100)}%`} />
        <Dato etiqueta="Estado" valor={etiquetaDeCodigo(detail.estado)} />
      </Datos>
      {detail.justificacion_enrutamiento && (
        <dl className="pt-1">
          <Dato etiqueta="Justificación del enrutamiento" valor={detail.justificacion_enrutamiento} />
        </dl>
      )}
    </Seccion>

    <DetalleClinico detail={detail} />

    {detail.historial_correcciones.length > 0 ? (
      <Seccion titulo="Historial de cambios">
        <DocumentCorrectionHistory historial={detail.historial_correcciones} />
      </Seccion>
    ) : (
      detail.audit_notes && (
        // Documentos auditados antes del historial: solo se conoce la última nota.
        <Seccion titulo="Notas de auditoría">
          <p className="text-xs text-slate-300 whitespace-pre-line break-words">{detail.audit_notes}</p>
        </Seccion>
      )
    )}
  </div>
);

export default DocumentDetailContent;
