import { api } from './api';
import type {
  AuditDetailResponse,
  AuditResolveRequest,
  DocumentFilterParams,
  DocumentListItemResponse,
  PaginatedDocumentResponse,
} from '../types/medical';
import type { IngestPayload, IngestResponse } from '../types/document';
import type { DocumentTypeActiveForLLM, QueueActiveForLLM } from '../types/catalog';

function buildDocumentQuery(params: DocumentFilterParams): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export const documentService = {
  listDocuments: (params: DocumentFilterParams = {}): Promise<PaginatedDocumentResponse> =>
    api.get<PaginatedDocumentResponse>(`/documents${buildDocumentQuery(params)}`),

  ingestDocument: (payload: IngestPayload): Promise<IngestResponse> =>
    api.post<IngestResponse>('/documents/ingest', payload),

  getAuditDetail: (documentoId: string): Promise<AuditDetailResponse> =>
    api.get<AuditDetailResponse>(`/audit/${documentoId}`),

  resolveAudit: (
    documentoId: string,
    payload: AuditResolveRequest,
  ): Promise<DocumentListItemResponse> =>
    api.put<DocumentListItemResponse>(`/audit/${documentoId}/resolve`, payload),

  getActiveQueues: (): Promise<QueueActiveForLLM[]> =>
    api.get<QueueActiveForLLM[]>('/catalogs/queues/active'),

  getActiveDocumentTypes: (): Promise<DocumentTypeActiveForLLM[]> =>
    api.get<DocumentTypeActiveForLLM[]>('/catalogs/document-types/active'),
};

