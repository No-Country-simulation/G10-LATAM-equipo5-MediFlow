import { api } from './api';
import { FASTAPI_ENDPOINTS } from '@/config/api';
import type {
  CoincidenciaArchivo,
  AuditDetailResponse,
  AuditClaimResponse,
  AuditDiscardRequest,
  AuditResolveRequest,
  DocumentCorrectionRequest,
  DocumentDetailResponse,
  DocumentFilterParams,
  DocumentListItemResponse,
  PaginatedDocumentResponse,
} from '../types/medical';
import type { DocumentTypeActiveForLLM, QueueActiveForLLM } from '../types/catalog';
import type { DashboardStatsParams, DashboardStatsResponse } from '../types/dashboard';

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

  getDashboardStats: (params: DashboardStatsParams): Promise<DashboardStatsResponse> =>
    api.get<DashboardStatsResponse>(
      `${FASTAPI_ENDPOINTS.documents.stats}?${new URLSearchParams({
        fecha_desde: params.fecha_desde,
        fecha_hasta: params.fecha_hasta,
        utc_offset_min: String(params.utc_offset_min),
      })}`
    ),

  markAttended: (documentoId: string): Promise<DocumentListItemResponse> =>
    api.post<DocumentListItemResponse>(FASTAPI_ENDPOINTS.documents.attend(documentoId)),

  unmarkAttended: (documentoId: string): Promise<DocumentListItemResponse> =>
    api.delete<DocumentListItemResponse>(FASTAPI_ENDPOINTS.documents.attend(documentoId)),

  getDocumentDetail: (documentoId: string): Promise<DocumentDetailResponse> =>
    api.get<DocumentDetailResponse>(FASTAPI_ENDPOINTS.documents.detail(documentoId)),

  correctDocument: (documentoId: string, payload: DocumentCorrectionRequest): Promise<DocumentListItemResponse> =>
    api.put<DocumentListItemResponse>(FASTAPI_ENDPOINTS.documents.detail(documentoId), payload),

  /** Documentos ya registrados con alguno de estos archivos (huellas SHA-256). */
  checkDuplicateFiles: (sha256: string[]): Promise<{ coincidencias: CoincidenciaArchivo[] }> =>
    api.post<{ coincidencias: CoincidenciaArchivo[] }>(FASTAPI_ENDPOINTS.documents.duplicatesCheck, { sha256 }),

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

