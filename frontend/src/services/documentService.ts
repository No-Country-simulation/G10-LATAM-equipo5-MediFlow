import { api } from './api';
import type {
  AuditDetailResponse,
  AuditClaimResponse,
  AuditDiscardRequest,
  AuditResolveRequest,
  DocumentFilterParams,
  DocumentListItemResponse,
  PaginatedDocumentResponse,
} from '../types/medical';
import type { IngestResponse } from '../types/document';
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

  ingestDocument: (file: File): Promise<IngestResponse> => {
    const n8nBaseUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || 'http://localhost:5678';
    const formData = new FormData();
    formData.append('file', file);
    return api.post<IngestResponse>(`${n8nBaseUrl}/webhook/mediflow/ingesta`, formData);
  },

  getAuditDetail: (documentoId: string): Promise<AuditDetailResponse> =>
    api.get<AuditDetailResponse>(`/audit/${documentoId}`),

  claimAuditCase: (documentoId: string): Promise<AuditClaimResponse> =>
    api.post<AuditClaimResponse>(`/audit/${documentoId}/claim`),

  releaseAuditCase: (documentoId: string): Promise<void> =>
    api.delete<void>(`/audit/${documentoId}/claim`),

  resolveAudit: (
    documentoId: string,
    payload: AuditResolveRequest,
  ): Promise<DocumentListItemResponse> =>
    api.put<DocumentListItemResponse>(`/audit/${documentoId}/resolve`, payload),

  discardAudit: (
    documentoId: string,
    payload: AuditDiscardRequest,
  ): Promise<DocumentListItemResponse> =>
    api.put<DocumentListItemResponse>(`/audit/${documentoId}/discard`, payload),

  getActiveQueues: (): Promise<QueueActiveForLLM[]> =>
    api.get<QueueActiveForLLM[]>('/catalogs/queues/active'),

  getActiveDocumentTypes: (): Promise<DocumentTypeActiveForLLM[]> =>
    api.get<DocumentTypeActiveForLLM[]>('/catalogs/document-types/active'),
};

