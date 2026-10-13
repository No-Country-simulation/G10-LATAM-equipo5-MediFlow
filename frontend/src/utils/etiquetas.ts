/**
 * Texto legible de los códigos de las listas (enums) del backend y del catálogo:
 * `LICENCIA_MEDICA` -> `Licencia Médica`. Los códigos conocidos llevan su tilde; cualquier otro
 * (por ejemplo, el de un tipo creado desde el mantenedor) se muestra con mayúscula inicial por
 * palabra y sin guiones bajos.
 */
const ETIQUETAS: Record<string, string> = {
  // Identificación y paciente
  RUT: 'RUT',
  DNI: 'DNI',
  CURP: 'CURP',
  CPF: 'CPF',
  CEDULA: 'Cédula',
  PASAPORTE: 'Pasaporte',
  F: 'Femenino',
  M: 'Masculino',
  X: 'No binario / otro',
  // Profesionales
  SOLICITANTE: 'Solicitante',
  INFORMANTE: 'Informante',
  TRATANTE: 'Tratante',
  DESTINATARIO: 'Destinatario',
  // Diagnósticos
  PRINCIPAL: 'Principal',
  SECUNDARIO: 'Secundario',
  CONFIRMADO: 'Confirmado',
  PRESUNTIVO: 'Presuntivo',
  DOCUMENTO: 'En el documento',
  INFERIDO: 'Inferido (IA)',
  AUDITOR: 'Auditor',
  // Medicamentos y exámenes
  PRESCRITO: 'Prescrito',
  ADMINISTRADO: 'Administrado',
  LABORATORIO: 'Laboratorio',
  IMAGENOLOGIA: 'Imagenología',
  PROCEDIMIENTO: 'Procedimiento',
  // Imagenología
  RX: 'Radiografía (RX)',
  TC: 'Tomografía (TC)',
  RM: 'Resonancia (RM)',
  ECO: 'Ecografía',
  MAMOGRAFIA: 'Mamografía',
  PET: 'PET',
  MEDICINA_NUCLEAR: 'Medicina Nuclear',
  // Atención de urgencia
  ALTA: 'Alta',
  HOSPITALIZACION: 'Hospitalización',
  TRASLADO: 'Traslado',
  FALLECIDO: 'Fallecido',
  // Certificado médico
  ATENCION: 'Atención',
  REPOSO: 'Reposo',
  LICENCIA_MEDICA: 'Licencia Médica',
  APTITUD: 'Aptitud',
  INFORME_MEDICO: 'Informe Médico',
  // Estados del documento
  PROCESADO: 'Procesado',
  PENDIENTE_AUDITORIA: 'Pendiente de auditoría',
  AUDITADO: 'Auditado',
  DESCARTADO: 'Descartado',
  ELIMINADO: 'Eliminado',
  // Genéricos
  OTRO: 'Otro',
  OTRA: 'Otra',
};

const conocida = (codigo: string): string | undefined =>
  Object.hasOwn(ETIQUETAS, codigo) ? ETIQUETAS[codigo] : undefined;

const capitalizar = (palabra: string) => palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();

/** Etiqueta para mostrar de un código (`LICENCIA_MEDICA` -> `Licencia Médica`). */
export const etiquetaDeCodigo = (codigo: string | number | null | undefined): string => {
  if (codigo === null || codigo === undefined || codigo === '') return '';
  const texto = String(codigo);
  const etiqueta = conocida(texto);
  if (etiqueta) return etiqueta;
  // Solo se transforman códigos de letras (MAYÚSCULAS_CON_GUIONES); texto libre o con números queda igual.
  if (!/^[A-Z]+(_[A-Z]+)*$/.test(texto)) return texto;
  return texto.split('_').filter(Boolean).map(capitalizar).join(' ');
};

/**
 * Etiqueta de un valor solo si es claramente un código: uno conocido o uno con guion bajo
 * (`LICENCIA_MEDICA`). Un texto en mayúsculas sin guiones (un nombre, `NEGATIVO`) queda igual.
 */
export const etiquetaSiEsCodigo = (valor: string): string =>
  conocida(valor) ?? (/^[A-Z]+(_[A-Z]+)+$/.test(valor) ? etiquetaDeCodigo(valor) : valor);

/** Texto para mostrar de un valor del detalle o del historial (listas unidas, Sí/No, códigos). */
export const textoDeValor = (valor: unknown): string => {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (Array.isArray(valor)) return valor.length ? valor.map(textoDeValor).join(', ') : '—';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return typeof valor === 'string' ? etiquetaSiEsCodigo(valor) : String(valor);
};
