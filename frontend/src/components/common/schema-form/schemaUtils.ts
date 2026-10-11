import type { JsonObject, JsonSchema, JsonSchemaType, JsonValue } from '../../../types/forms';

/** Largo a partir del cual un texto se edita en un área de texto en vez de una línea. */
export const LARGO_TEXTO_MULTILINEA = 200;

/** Tipo principal de un esquema (`["string", "null"]` -> `string`). */
export const tipoDe = (schema: JsonSchema | undefined): JsonSchemaType | undefined => {
  const tipo = schema?.type;
  return Array.isArray(tipo) ? tipo.find((t) => t !== 'null') : tipo;
};

export const esEscalar = (schema: JsonSchema | undefined): boolean => {
  const tipo = tipoDe(schema);
  return tipo !== 'object' && tipo !== 'array';
};

/** `fecha_control` -> `Fecha control`, para campos sin `title`. */
export const humanizar = (nombre: string): string => {
  const texto = nombre.replace(/_/g, ' ').trim();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

export const etiquetaDe = (nombre: string, schema: JsonSchema): string => schema.title || humanizar(nombre);

/** Propiedades en el orden definido por el backend (`propertyOrdering`, si viene). */
export const propiedadesDe = (schema: JsonSchema): [string, JsonSchema][] => {
  const propiedades = schema.properties ?? {};
  const orden = (schema.propertyOrdering ?? []).filter((p) => p in propiedades);
  const resto = Object.keys(propiedades).filter((p) => !orden.includes(p));
  return [...orden, ...resto].map((p) => [p, propiedades[p]]);
};

export const esMultilinea = (schema: JsonSchema): boolean =>
  tipoDe(schema) === 'string' && !schema.enum && !schema.format && (schema.maxLength ?? 0) > LARGO_TEXTO_MULTILINEA;

/** Valor vacío para agregar una fila: un objeto con sus campos en `null` o un texto vacío. */
export const valorInicial = (schema: JsonSchema | undefined): JsonValue => {
  const tipo = tipoDe(schema);
  if (tipo === 'object' && schema) {
    return Object.fromEntries(propiedadesDe(schema).map(([nombre, hijo]) => [nombre, tipoDe(hijo) === 'array' ? [] : null]));
  }
  if (tipo === 'array') return [];
  return null;
};

export const comoObjeto = (value: JsonValue | undefined): JsonObject =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};

export const comoLista = (value: JsonValue | undefined): JsonValue[] => (Array.isArray(value) ? value : []);
