import { api } from './api';
import { FASTAPI_ENDPOINTS } from '@/config/api';
import type { AreaSummary, QueueSummary } from '../types/auth';
import type { DocumentForms } from '../types/forms';
import type {
  AreaRecord,
  CatalogPayload,
  CatalogRecord,
  DeleteResponse,
  DocumentTypeRecord,
  QueueRecord,
} from '../types/catalog';

export interface CatalogApi<T extends CatalogRecord> {
  list: () => Promise<T[]>;
  create: (payload: CatalogPayload) => Promise<T>;
  update: (id: string, payload: CatalogPayload) => Promise<T>;
  remove: (id: string) => Promise<DeleteResponse>;
}

/** Los tres catálogos exponen el mismo CRUD en el backend; solo cambia la ruta base. */
const createCatalogApi = <T extends CatalogRecord>(basePath: string): CatalogApi<T> => ({
  list: () => api.get<T[]>(basePath),
  create: (payload) => api.post<T>(basePath, payload),
  update: (id, payload) => api.put<T>(`${basePath}/${id}`, payload),
  remove: (id) => api.delete<DeleteResponse>(`${basePath}/${id}`),
});

export const catalogService = {
  documentTypes: createCatalogApi<DocumentTypeRecord>(FASTAPI_ENDPOINTS.catalogs.documentTypes),
  queues: createCatalogApi<QueueRecord>(FASTAPI_ENDPOINTS.catalogs.queues),
  areas: createCatalogApi<AreaRecord>(FASTAPI_ENDPOINTS.catalogs.areas),
  getActiveAreas: () => api.get<AreaSummary[]>(FASTAPI_ENDPOINTS.catalogs.areasActive),
  getQueuesSummary: () => api.get<QueueSummary[]>(FASTAPI_ENDPOINTS.catalogs.queuesSummary),
  getDocumentForms: () => api.get<DocumentForms>(FASTAPI_ENDPOINTS.catalogs.documentTypeForms),
};
