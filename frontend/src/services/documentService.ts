import { api } from './api';
import { FASTAPI_ENDPOINTS } from '@/config/api';
import type {
  AuditDetailResponse,
  AuditClaimResponse,
  AuditDiscardRequest,
  AuditResolveRequest,
  DocumentFilterParams,
  DocumentListItemResponse,
  PaginatedDocumentResponse,
} from '../types/medical';
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
    api.get<PaginatedDocumentResponse>(`${FASTAPI_ENDPOINTS.documents.base}${buildDocumentQuery(params)}`),

  getAuditDetail: (documentoId: string): Promise<AuditDetailResponse> =>
    api.get<AuditDetailResponse>(FASTAPI_ENDPOINTS.audit.detail(documentoId)),

  claimAuditCase: (documentoId: string): Promise<AuditClaimResponse> =>
    api.post<AuditClaimResponse>(FASTAPI_ENDPOINTS.audit.claim(documentoId)),

  releaseAuditCase: (documentoId: string): Promise<void> =>
    api.delete<void>(FASTAPI_ENDPOINTS.audit.claim(documentoId)),

  resolveAudit: (
    documentoId: string,
    payload: AuditResolveRequest,
  ): Promise<DocumentListItemResponse> =>
    api.put<DocumentListItemResponse>(FASTAPI_ENDPOINTS.audit.resolve(documentoId), payload),

  discardAudit: (
    documentoId: string,
    payload: AuditDiscardRequest,
  ): Promise<DocumentListItemResponse> =>
    api.put<DocumentListItemResponse>(FASTAPI_ENDPOINTS.audit.discard(documentoId), payload),

  getActiveQueues: (): Promise<QueueActiveForLLM[]> =>
    api.get<QueueActiveForLLM[]>(FASTAPI_ENDPOINTS.catalogs.queuesActive),

  getActiveDocumentTypes: (): Promise<DocumentTypeActiveForLLM[]> =>
    api.get<DocumentTypeActiveForLLM[]>(FASTAPI_ENDPOINTS.catalogs.documentTypesActive),
};

