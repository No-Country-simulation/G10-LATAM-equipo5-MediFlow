import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DocumentsPage from './DocumentsPage';
import type { DocumentListItemResponse } from '../types/medical';
import type { UserRole } from '../types/auth';

let mockUserRole: UserRole = 'ADMIN';
let mockDocuments: DocumentListItemResponse[] = [];
let mockState: 'idle' | 'loading' | 'success' | 'error' = 'success';
let mockError: string | null = null;
const mockReload = vi.fn();
let lastQueriedParams: Record<string, unknown> = {};

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u-1', username: 'testuser', role: mockUserRole },
  }),
}));

vi.mock('../hooks/useDocumentList', () => ({
  useDocumentList: (params: Record<string, unknown>) => {
    lastQueriedParams = params;
    return {
      documents: mockDocuments,
      state: mockState,
      error: mockError,
      reload: mockReload,
    };
  },
}));

vi.mock('../hooks/useCatalogs', () => ({
  useCatalogs: () => ({
    queues: [
      { id: 'q-1', codigo: 'Cola_Urgencias', nombre: 'Urgencias' },
      { id: 'q-2', codigo: 'Cola_Medicina_Interna', nombre: 'Medicina Interna' },
    ],
  }),
}));

vi.mock('../hooks/useActiveAreas', () => ({
  useActiveAreas: () => ({
    areas: [{ id: 'area-1', nombre: 'Box 1', activa: true }],
  }),
}));

vi.mock('../components/documents/DocumentsKanbanBoard', () => ({
  default: ({ documents, selectedDestination }: { documents: DocumentListItemResponse[]; selectedDestination: string }) => (
    <div data-testid="documents-kanban-board" data-destination={selectedDestination}>
      Tablero Kanban ({documents.length} casos)
    </div>
  ),
}));

vi.mock('../components/documents/DocumentsListView', () => ({
  default: ({ documents }: { documents: DocumentListItemResponse[] }) => (
    <div data-testid="documents-list-view">
      Vista de Lista ({documents.length} casos)
    </div>
  ),
}));

describe('DocumentsPage URL sync, view toggling and search filters', () => {
  const sampleDoc: DocumentListItemResponse = {
    documento_id: 'DOC-REPO-101',
    nombre_paciente: 'Gabriela Mistral',
    identificacion_paciente: '7788990-1',
    tipo_identificacion: 'RUT',
    tipo_documento: 'INTERCONSULTA',
    diagnostico_principal: 'Diabetes Mellitus Tipo 2 no controlada',
    nivel_prioridad: 'Prioritario',
    destino_enrutamiento: 'Cola_Medicina_Interna',
    score_confianza: 0.88,
    estado: 'PROCESADO',
    oci_json_path: 'mock/path.json',
    created_at: '2026-10-14T09:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRole = 'ADMIN';
    mockDocuments = [sampleDoc];
    mockState = 'success';
    mockError = null;
    lastQueriedParams = {};
  });

  const renderWithRouter = (initialEntry = '/documentos') => {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/documentos" element={<DocumentsPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('renders page header and default Kanban board view', () => {
    renderWithRouter();

    expect(screen.getByText('Expedientes y Flujos Documentales')).toBeInTheDocument();
    expect(screen.getByTestId('documents-kanban-board')).toBeInTheDocument();
    expect(screen.getByText(/Tablero Kanban \(1 casos\)/)).toBeInTheDocument();
  });

  it('initializes filters from URL SearchParams (?prioridad=Urgente&estado=PROCESADO&desde=...&hasta=...)', () => {
    renderWithRouter('/documentos?prioridad=Urgente&estado=PROCESADO&desde=2026-10-01&hasta=2026-10-15');

    expect(lastQueriedParams.prioridad).toBe('Urgente');
    expect(lastQueriedParams.estado).toBe('PROCESADO');
    expect(lastQueriedParams.fecha_desde).toBeDefined();
    expect(lastQueriedParams.fecha_hasta).toBeDefined();
  });

  it('toggles between Kanban board and List view while retaining filters', () => {
    renderWithRouter();

    // Default view is Kanban
    expect(screen.getByTestId('documents-kanban-board')).toBeInTheDocument();
    expect(screen.queryByTestId('documents-list-view')).not.toBeInTheDocument();

    // Switch to List view
    const listBtn = screen.getByRole('button', { name: /vista de lista/i });
    fireEvent.click(listBtn);

    expect(screen.getByTestId('documents-list-view')).toBeInTheDocument();
    expect(screen.queryByTestId('documents-kanban-board')).not.toBeInTheDocument();

    // Switch back to Kanban
    const kanbanBtn = screen.getByRole('button', { name: /vista de tablero/i });
    fireEvent.click(kanbanBtn);

    expect(screen.getByTestId('documents-kanban-board')).toBeInTheDocument();
  });

  it('updates filters and triggers queryParams when searching by patient identification', async () => {
    const user = userEvent.setup();
    renderWithRouter();

    const searchInput = screen.getByPlaceholderText(/RUT, DNI, cédula/i);
    await user.type(searchInput, '7788990-1');

    await waitFor(() => {
      expect(lastQueriedParams.identificacion).toBe('7788990-1');
    });
  });

  it('renders empty state when there are no documents matching filters', () => {
    mockDocuments = [];
    mockState = 'success';

    renderWithRouter();

    expect(screen.getByText('Sin expedientes registrados')).toBeInTheDocument();
    expect(screen.getByText(/No hay documentos clínicos que coincidan con los filtros/)).toBeInTheDocument();
  });

  it('renders repository error banner when useDocumentList returns an error', () => {
    mockState = 'error';
    mockError = 'Fallo en la conexión al repositorio OCI';

    renderWithRouter();

    expect(screen.getByText('No se pudo cargar el repositorio')).toBeInTheDocument();
    expect(screen.getByText('Fallo en la conexión al repositorio OCI')).toBeInTheDocument();
  });

  it('hides area filter for OPERADOR role and shows it for ADMIN role', () => {
    mockUserRole = 'OPERADOR';
    const { unmount } = renderWithRouter();

    expect(screen.queryByText('Área de origen')).not.toBeInTheDocument();
    unmount();

    mockUserRole = 'ADMIN';
    renderWithRouter();

    expect(screen.getByText('Área de origen')).toBeInTheDocument();
  });
});
