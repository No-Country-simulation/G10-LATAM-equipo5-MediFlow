export interface QueueActiveForLLM {
  codigo: string;
  nombre: string;
  descripcion_semantica: string;
}

export interface DocumentTypeActiveForLLM {
  codigo: string;
  nombre: string;
  descripcion: string | null;
}

/** Campos comunes a todo registro de catálogo (vista de administración). */
interface CatalogRecordBase {
  id: string;
  codigo: string;
  nombre: string;
  is_active: boolean;
  es_sistema: boolean;
  created_at: string;
  updated_at?: string | null;
  updated_by_id?: string | null;
}

export interface QueueRecord extends CatalogRecordBase {
  descripcion_semantica: string;
  notificar_inmediato: boolean;
}

export interface DocumentTypeRecord extends CatalogRecordBase {
  descripcion: string;
  campos_extraccion: Record<string, unknown> | null;
}

export interface AreaRecord extends CatalogRecordBase {
  descripcion: string | null;
}

export type CatalogRecord = QueueRecord | DocumentTypeRecord | AreaRecord;

/** Valores que envía el formulario de un catálogo (alta o edición parcial). */
export type CatalogPayload = Record<string, unknown>;

export type DeletionType = 'HARD_DELETE' | 'SOFT_DELETE';

export interface DeleteResponse {
  message: string;
  deletion_type: DeletionType;
}
