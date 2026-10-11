/**
 * JSON Schema (subconjunto) que publica el backend en GET /catalogs/document-types/forms.
 * Es la misma fuente que usa n8n para el prompt: el formulario de auditoría muestra exactamente
 * los campos que la IA debe extraer para cada tipo.
 */
export type JsonSchemaType = 'string' | 'integer' | 'number' | 'boolean' | 'object' | 'array' | 'null';

export interface JsonSchema {
  type?: JsonSchemaType | JsonSchemaType[];
  title?: string;
  properties?: Record<string, JsonSchema>;
  propertyOrdering?: string[];
  items?: JsonSchema;
  enum?: (string | number | null)[];
  format?: string;
  maxLength?: number;
  minimum?: number;
  readOnly?: boolean;
}

export interface DocumentTypeForm {
  codigo: string;
  nombre: string;
  descripcion: string;
  /** Bloque de `detalle_clinico` del tipo; `null` si no tiene campos propios (RECETA, OTRO). */
  bloque: string | null;
  esquema: JsonSchema | null;
}

export interface DocumentForms {
  datos_generales: JsonSchema;
  /** Listas que cualquier tipo puede traer: `medicamentos`, `examenes_solicitados`. */
  comunes: Record<string, JsonSchema>;
  tipos: DocumentTypeForm[];
}

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
