import type { DocumentForms, JsonObject, JsonValue } from '../types/forms';
import type { DuplicadoDocumento } from '../types/medical';

const objeto = (value: unknown): JsonObject =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};

const texto = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);

/**
 * `datos_generales` del JSON guardado, en el formato del formulario (contrato v2).
 *
 * Los documentos ingeridos antes del contrato v2 traían `paciente.rut`, `medico_solicitante` y el
 * diagnóstico como texto suelto: se convierten para que también puedan auditarse.
 */
export const datosGeneralesDesdeJson = (raw: Record<string, unknown> | null | undefined): JsonObject => {
  const datos = objeto(raw?.datos_generales);
  const paciente = objeto(datos.paciente);
  const rutAntiguo = texto(paciente.rut);
  const medicoAntiguo = objeto(datos.medico_solicitante);

  const identificacion =
    paciente.identificacion ?? (rutAntiguo ? { tipo: 'RUT', numero: rutAntiguo, pais: 'CL' } : null);
  const profesionales: JsonValue[] = Array.isArray(datos.profesionales)
    ? datos.profesionales
    : [medicoAntiguo]
        .filter((m) => texto(m.nombre))
        .map((m) => ({ nombre: m.nombre, identificacion: m.rut ?? null, registro_profesional: m.matricula ?? null, rol: 'SOLICITANTE' }));
  const diagnosticos: JsonValue[] = Array.isArray(datos.diagnosticos)
    ? datos.diagnosticos
    : [datos]
        .filter((d) => texto(d.diagnostico_principal))
        .map((d) => ({ descripcion: d.diagnostico_principal, cie10: d.cie10_sugerido ?? null, tipo: 'PRINCIPAL', certeza: 'PRESUNTIVO' }));

  return {
    paciente: {
      nombre: paciente.nombre ?? null,
      identificacion,
      edad: paciente.edad ?? null,
      fecha_nacimiento: paciente.fecha_nacimiento ?? null,
      sexo: paciente.sexo ?? null,
      numero_ficha: paciente.numero_ficha ?? null,
    },
    profesionales,
    institucion_emisora: datos.institucion_emisora ?? null,
    fecha_documento: datos.fecha_documento ?? null,
    diagnosticos,
  };
};

/**
 * Detalle clínico al cambiar de tipo: se conservan las listas comunes (medicamentos, exámenes) y
 * el bloque del tipo nuevo si ya existía; el bloque del tipo anterior se descarta, porque el
 * backend rechaza un bloque que no corresponde al tipo.
 *
 * Sin los esquemas (`forms` aún cargando) no se sabe qué bloques corresponden: el detalle se
 * devuelve intacto, para no borrar datos por enviar el formulario antes de tiempo.
 */
export const detalleParaTipo = (detalle: JsonObject, tipo: string, forms: DocumentForms | null): JsonObject => {
  if (!forms) return detalle;
  const bloque = forms.tipos.find((t) => t.codigo === tipo)?.bloque;
  const permitidos = new Set([...Object.keys(forms.comunes), ...(bloque ? [bloque] : [])]);
  return Object.fromEntries(Object.entries(detalle).filter(([clave]) => permitidos.has(clave)));
};

/** Mensaje de error del formulario antes de enviar (el backend vuelve a validar todo). */
export const validarAuditoria = (datos: JsonObject, notas: string): string | null => {
  if (!texto(objeto(datos.paciente).nombre)) return 'El nombre del paciente es obligatorio.';
  const diagnosticos = Array.isArray(datos.diagnosticos) ? datos.diagnosticos.map(objeto) : [];
  const principal = diagnosticos.find((d) => d.tipo === 'PRINCIPAL') ?? diagnosticos[0];
  if (!principal || !texto(principal.descripcion)) return 'Indica al menos el diagnóstico principal.';
  if (!notas.trim()) return 'La justificación de las correcciones es obligatoria.';
  return null;
};

/** Duplicados detectados al ingerir (`raw_extracted_json.triaje.duplicados`). */
export const duplicadosDesdeJson = (raw: Record<string, unknown> | null | undefined): DuplicadoDocumento[] => {
  const triaje = raw?.triaje as { duplicados?: unknown } | undefined;
  return Array.isArray(triaje?.duplicados) ? (triaje.duplicados as DuplicadoDocumento[]) : [];
};
