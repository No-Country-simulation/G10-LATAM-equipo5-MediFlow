import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TriagePage from './TriagePage';
import { documentService } from '../services/documentService';
import type { DocumentListItemResponse } from '../types/medical';
import type { QueueSummary } from '../types/auth';

const mockReload = vi.fn();
const mockNotificarCambio = vi.fn();
let mockColas: QueueSummary[] = [];
let mockCases: DocumentListItemResponse[] = [];
let mockState: 'idle' | 'loading' = 'idle';
let mockLoaded = true;
let mockError: string | null = null;
let mockUserRole: string = 'ADMIN';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u-1', username: 'clinico', role: mockUserRole },
  }),
}));

vi.mock('../hooks/useTriageConsole', () => ({
  useTriageConsole: () => ({
    colas: mockColas,
    cases: mockCases,
    loaded: mockLoaded,
    state: mockState,
    error: mockError,
    reload: mockReload,
  }),
}));

vi.mock('../context/documentDetailContext', () => ({
  useDocumentDetailModal: () => ({
    notificarCambio: mockNotificarCambio,
    abrirDocumento: vi.fn(),
  }),
}));

vi.mock('../services/documentService', () => ({
  documentService: {
    markAttended: vi.fn(),
    unmarkAttended: vi.fn(),
    deriveDocument: vi.fn(),
  },
}));

vi.mock('../hooks/useQueuesSummary', () => ({
  useQueuesSummary: () => ({
    queues: mockColas,
    error: null,
    loading: false,
    reload: vi.fn(),
  }),
}));

describe('TriagePage clinical triage console and undo flow', () => {
  const sampleCase: DocumentListItemResponse = {
    documento_id: 'DOC-TRIAGE-777',
    nombre_paciente: 'Arturo Prat',
    identificacion_paciente: '11223344-5',
    tipo_identificacion: 'RUT',
    tipo_documento: 'INFORME_URGENCIA',
    diagnostico_principal: 'Sospecha de Tromboembolismo Pulmonar Agudo',
    nivel_prioridad: 'Urgente',
    destino_enrutamiento: 'Cola_Urgencias',
    score_confianza: 0.99,
    estado: 'PROCESADO',
    oci_json_path: 'mock/path.json',
    created_at: '2026-10-17T01:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRole = 'ADMIN';
    mockColas = [
      {
        id: 'q-1',
        codigo: 'Cola_Urgencias',
        nombre: 'Servicio de Urgencias',
        es_asistencial: true,
      },
    ];
    mockCases = [sampleCase];
    mockState = 'idle';
    mockLoaded = true;
    mockError = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders triage console with KPI cards, queue cases and urgent alert banner', () => {
    render(<TriagePage />);

    expect(screen.getByRole('heading', { name: 'Consola de Triaje Asistencial' })).toBeInTheDocument();
    expect(screen.getByText('Arturo Prat')).toBeInTheDocument();
    expect(screen.getByText(/Tromboembolismo Pulmonar/i)).toBeInTheDocument();
    expect(screen.getByText(/Alerta de Urgencia Crítica/i)).toBeInTheDocument();
  });

  it('marks a case as attended, hides it from view, and displays undo banner', async () => {
    vi.mocked(documentService.markAttended).mockResolvedValueOnce(sampleCase);

    render(<TriagePage />);

    // Click "Marcar atendido" on card
    const attendBtn = screen.getByRole('button', { name: /marcar atendido/i });
    fireEvent.click(attendBtn);

    // ConfirmAttendModal should appear
    expect(screen.getByRole('heading', { name: 'Confirmar Atención de Caso' })).toBeInTheDocument();

    // Confirm attendance
    const confirmBtn = screen.getByRole('button', { name: /confirmar atención/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(documentService.markAttended).toHaveBeenCalledWith('DOC-TRIAGE-777');
    });

    // The case card is hidden from active list
    expect(screen.queryByRole('heading', { name: 'Confirmar Atención de Caso' })).not.toBeInTheDocument();
    expect(screen.queryByText('Arturo Prat')).not.toBeInTheDocument();

    // Status banner appears with "Deshacer" button
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent(/Arturo Prat marcado como atendido; salió de la consola/);
    expect(screen.getByRole('button', { name: /deshacer/i })).toBeInTheDocument();
  });

  it('allows undoing ("Deshacer") attendance and restores the case to active view', async () => {
    vi.mocked(documentService.markAttended).mockResolvedValueOnce(sampleCase);
    vi.mocked(documentService.unmarkAttended).mockResolvedValueOnce(sampleCase);

    render(<TriagePage />);

    // Attend case
    fireEvent.click(screen.getByRole('button', { name: /marcar atendido/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar atención/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /deshacer/i })).toBeInTheDocument();
    });

    // Click "Deshacer"
    const undoBtn = screen.getByRole('button', { name: /deshacer/i });
    fireEvent.click(undoBtn);

    await waitFor(() => {
      expect(documentService.unmarkAttended).toHaveBeenCalledWith('DOC-TRIAGE-777');
    });

    // Case is restored in the active view
    expect(screen.getByText('Arturo Prat')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(mockReload).toHaveBeenCalled();
  });

  it('automatically dismisses the undo feedback banner after 10 seconds', async () => {
    vi.useFakeTimers();
    vi.mocked(documentService.markAttended).mockResolvedValueOnce(sampleCase);

    render(<TriagePage />);

    fireEvent.click(screen.getByRole('button', { name: /marcar atendido/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar atención/i }));

    // Flush promises
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('status')).toBeInTheDocument();

    // Advance 9.9 seconds - banner still there
    act(() => {
      vi.advanceTimersByTime(9900);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();

    // Advance past 10 seconds - banner auto-dismisses
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('displays action error alert when undo fails', async () => {
    vi.mocked(documentService.markAttended).mockResolvedValueOnce(sampleCase);
    vi.mocked(documentService.unmarkAttended).mockRejectedValueOnce(new Error('Conflicto al revertir'));

    render(<TriagePage />);

    fireEvent.click(screen.getByRole('button', { name: /marcar atendido/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar atención/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /deshacer/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /deshacer/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Conflicto al revertir');
  });

  it('opens DeriveCaseModal and handles case derivation feedback', async () => {
    const user = userEvent.setup();
    mockColas.push({
      id: 'q-2',
      codigo: 'Cola_UCI',
      nombre: 'Unidad de Cuidados Intensivos',
      es_asistencial: true,
    });
    vi.mocked(documentService.deriveDocument).mockResolvedValueOnce({
      ...sampleCase,
      destino_enrutamiento: 'Cola_UCI',
    });

    render(<TriagePage />);

    // Click "Derivar"
    const deriveBtn = screen.getByRole('button', { name: /derivar/i });
    await user.click(deriveBtn);

    expect(screen.getByRole('heading', { name: 'Derivar caso' })).toBeInTheDocument();

    // Select destination and write motive
    const select = screen.getByLabelText('Derivar a');
    await user.selectOptions(select, 'Cola_UCI');

    const motivoInput = screen.getByLabelText('Motivo');
    await user.type(motivoInput, 'Paciente inestable requiere UCI');

    // Submit derivation
    const modal = screen.getByRole('dialog');
    const submitBtn = within(modal).getByRole('button', { name: /^derivar$/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(documentService.deriveDocument).toHaveBeenCalledWith('DOC-TRIAGE-777', {
        destino: 'Cola_UCI',
        motivo: 'Paciente inestable requiere UCI',
      });
    });

    expect(mockNotificarCambio).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(/derivado a Unidad de Cuidados Intensivos/);
  });
});
