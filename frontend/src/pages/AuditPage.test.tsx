import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuditPage from './AuditPage';
import { documentService } from '../services/documentService';
import type { DocumentListItemResponse } from '../types/medical';

const mockReload = vi.fn();
let mockDocuments: DocumentListItemResponse[] = [];
let mockState: 'idle' | 'loading' | 'success' | 'error' = 'success';
let mockListError: string | null = null;

vi.mock('../hooks/useDocumentList', () => ({
  useDocumentList: () => ({
    documents: mockDocuments,
    state: mockState,
    reload: mockReload,
    error: mockListError,
  }),
}));

vi.mock('../services/documentService', () => ({
  documentService: {
    claimAuditCase: vi.fn(),
  },
}));

vi.mock('../components/audit/AuditDetailPanel', () => ({
  default: ({ documentId, onClose }: { documentId: string; onClose: () => void }) => (
    <div data-testid="audit-detail-panel">
      <span>Detalle Caso: {documentId}</span>
      <button onClick={onClose}>Volver a la bandeja</button>
    </div>
  ),
}));

vi.mock('../context/documentDetailContext', () => ({
  useDocumentDetailModal: () => ({
    abrirDocumento: vi.fn(),
  }),
}));

describe('AuditPage clinical human-in-the-loop and concurrency collision', () => {
  const sampleDoc: DocumentListItemResponse = {
    documento_id: 'DOC-AUDIT-409',
    nombre_paciente: 'Carlos Valenzuela',
    identificacion_paciente: '12345678-5',
    tipo_identificacion: 'RUT',
    tipo_documento: 'EPICRISIS',
    diagnostico_principal: 'Insuficiencia Cardíaca Congestiva descompensada',
    nivel_prioridad: 'Prioritario',
    destino_enrutamiento: 'Cola_Medicina_Interna',
    score_confianza: 0.62,
    estado: 'PENDIENTE_AUDITORIA',
    oci_json_path: 'mock/path.json',
    created_at: '2026-10-15T10:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDocuments = [sampleDoc];
    mockState = 'success';
    mockListError = null;
  });

  it('renders loading skeleton when state is loading', () => {
    mockState = 'loading';
    mockDocuments = [];

    const { container } = render(<AuditPage />);

    expect(screen.getByText(/Bandeja de Auditoría Clínica/i)).toBeInTheDocument();
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders empty queue message when no documents require audit', () => {
    mockDocuments = [];

    render(<AuditPage />);

    expect(screen.getByText('No hay documentos pendientes de auditoría.')).toBeInTheDocument();
    expect(screen.getByText(/0 pendientes/i)).toBeInTheDocument();
  });

  it('renders pending document list with patient info and count badge', () => {
    render(<AuditPage />);

    expect(screen.getByText(/1 pendiente/i)).toBeInTheDocument();
    expect(screen.getByText('DOC-AUDIT-409')).toBeInTheDocument();
    expect(screen.getByText('Carlos Valenzuela')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /revisar/i })).toBeInTheDocument();
  });

  it('handles HTTP 409 concurrency collision: shows warning banner and reloads queue', async () => {
    const error409 = { status: 409, message: 'Conflict: case claimed' };
    vi.mocked(documentService.claimAuditCase).mockRejectedValueOnce(error409);

    render(<AuditPage />);

    const reviewButton = screen.getByRole('button', { name: /revisar/i });
    fireEvent.click(reviewButton);

    await waitFor(() => {
      expect(documentService.claimAuditCase).toHaveBeenCalledWith('DOC-AUDIT-409');
    });

    const expectedMessage = 'El caso DOC-AUDIT-409 ya fue tomado por otro auditor o no está pendiente.';
    expect(await screen.findByText(expectedMessage)).toBeInTheDocument();
    expect(mockReload).toHaveBeenCalledTimes(1);

    // Can dismiss banner
    const closeErrorBtn = screen.getByRole('button', { name: /cerrar/i });
    fireEvent.click(closeErrorBtn);
    expect(screen.queryByText(expectedMessage)).not.toBeInTheDocument();
  });

  it('handles generic claim error with message fallback and reloads queue', async () => {
    vi.mocked(documentService.claimAuditCase).mockRejectedValueOnce(new Error('Fallo de conexión'));

    render(<AuditPage />);

    fireEvent.click(screen.getByRole('button', { name: /revisar/i }));

    expect(await screen.findByText('Fallo de conexión')).toBeInTheDocument();
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('transitions to AuditDetailPanel on successful case claim and returns on close', async () => {
    vi.mocked(documentService.claimAuditCase).mockResolvedValueOnce({
      documento_id: 'DOC-AUDIT-409',
      asignado_a_id: 'u-auditor',
      asignado_a_username: 'auditor1',
      asignado_at: '2026-10-17T02:00:00Z',
      expira_at: '2026-10-17T02:30:00Z',
    });

    render(<AuditPage />);

    fireEvent.click(screen.getByRole('button', { name: /revisar/i }));

    expect(await screen.findByTestId('audit-detail-panel')).toBeInTheDocument();
    expect(screen.getByText('Detalle Caso: DOC-AUDIT-409')).toBeInTheDocument();

    // Close panel
    fireEvent.click(screen.getByRole('button', { name: /volver a la bandeja/i }));

    expect(screen.queryByTestId('audit-detail-panel')).not.toBeInTheDocument();
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('triggers reload when clicking the refresh button', () => {
    render(<AuditPage />);

    const refreshBtn = screen.getByRole('button', { name: /actualizar bandeja de auditoría/i });
    fireEvent.click(refreshBtn);

    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('renders list error banner when useDocumentList returns an error', () => {
    mockListError = 'Error al sincronizar con el repositorio central';

    render(<AuditPage />);

    expect(screen.getByText('Error al sincronizar con el repositorio central')).toBeInTheDocument();
  });
});
