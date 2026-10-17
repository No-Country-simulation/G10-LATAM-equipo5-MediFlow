import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeriveCaseModal from './DeriveCaseModal';
import type { DocumentListItemResponse } from '../../types/medical';
import type { QueueSummary } from '../../types/auth';

let mockQueues: QueueSummary[] = [];
let mockQueuesError: string | null = null;

vi.mock('../../hooks/useQueuesSummary', () => ({
  useQueuesSummary: () => ({
    queues: mockQueues,
    error: mockQueuesError,
    loading: false,
    reload: vi.fn(),
  }),
}));

describe('DeriveCaseModal clinical derivation workflow', () => {
  const sampleDoc: DocumentListItemResponse = {
    documento_id: 'DOC-DERIVE-001',
    nombre_paciente: 'Elena Morales',
    identificacion_paciente: '9988776-5',
    tipo_identificacion: 'RUT',
    tipo_documento: 'INFORME_BIOPSIA',
    diagnostico_principal: 'Carcinoma de colon etapa II',
    nivel_prioridad: 'Prioritario',
    destino_enrutamiento: 'Cola_Cirugia_General',
    score_confianza: 0.92,
    estado: 'PROCESADO',
    oci_json_path: 'mock/path.json',
    created_at: '2026-10-16T12:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockQueues = [
      {
        id: 'q-1',
        codigo: 'Cola_Cirugia_General',
        nombre: 'Cirugía General',
        es_asistencial: true,
      },
      {
        id: 'q-2',
        codigo: 'Cola_Oncologia',
        nombre: 'Oncología Médica',
        es_asistencial: true,
      },
      {
        id: 'q-3',
        codigo: 'Cola_Administrativa',
        nombre: 'Archivo Pasivo',
        es_asistencial: false,
      },
    ];
    mockQueuesError = null;
  });

  it('renders modal with patient details and filters out the current queue', () => {
    render(
      <DeriveCaseModal
        doc={sampleDoc}
        currentQueueName="Cirugía General"
        onClose={vi.fn()}
        onDerive={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Derivar caso' })).toBeInTheDocument();
    expect(screen.getByText(/Elena Morales · hoy en Cirugía General/)).toBeInTheDocument();

    // Current queue (Cola_Cirugia_General) should not be available to prevent redundant derivation
    expect(screen.queryByRole('option', { name: /^Cirugía General$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Oncología Médica' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Archivo Pasivo (fuera de Triaje)' })).toBeInTheDocument();
  });

  it('validates that destination queue is selected before deriving', async () => {
    render(
      <DeriveCaseModal
        doc={sampleDoc}
        currentQueueName="Cirugía General"
        onClose={vi.fn()}
        onDerive={vi.fn()}
      />
    );

    const motivoInput = screen.getByLabelText('Motivo');
    fireEvent.change(motivoInput, { target: { value: 'Paciente requiere evaluación oncológica urgente' } });

    fireEvent.submit(screen.getByRole('button', { name: /derivar/i }).closest('form')!);

    expect(await screen.findByText('Elige la cola de destino')).toBeInTheDocument();
  });

  it('validates that motivo has at least 5 characters', async () => {
    render(
      <DeriveCaseModal
        doc={sampleDoc}
        currentQueueName="Cirugía General"
        onClose={vi.fn()}
        onDerive={vi.fn()}
      />
    );

    const select = screen.getByLabelText('Derivar a');
    fireEvent.change(select, { target: { value: 'Cola_Oncologia' } });

    const motivoInput = screen.getByLabelText('Motivo');
    fireEvent.change(motivoInput, { target: { value: 'abc' } });

    fireEvent.submit(screen.getByRole('button', { name: /derivar/i }).closest('form')!);

    expect(await screen.findByText('El motivo debe tener al menos 5 caracteres')).toBeInTheDocument();
  });

  it('submits valid derivation and disables buttons while processing', async () => {
    let resolveDerive: (value: string | null) => void = () => {};
    const onDeriveMock = vi.fn().mockImplementation(() => new Promise((resolve) => {
      resolveDerive = resolve;
    }));
    const user = userEvent.setup();

    render(
      <DeriveCaseModal
        doc={sampleDoc}
        currentQueueName="Cirugía General"
        onClose={vi.fn()}
        onDerive={onDeriveMock}
      />
    );

    const select = screen.getByLabelText('Derivar a');
    await user.selectOptions(select, 'Cola_Oncologia');

    const motivoInput = screen.getByLabelText('Motivo');
    await user.type(motivoInput, 'Biopsia positiva confirma malignidad.');

    const submitBtn = screen.getByRole('button', { name: /derivar/i });
    const cancelBtn = screen.getByRole('button', { name: /cancelar/i });

    await user.click(submitBtn);

    expect(onDeriveMock).toHaveBeenCalledWith('Cola_Oncologia', 'Biopsia positiva confirma malignidad.');
    expect(submitBtn).toBeDisabled();
    expect(cancelBtn).toBeDisabled();

    // Finish submission
    resolveDerive(null);
    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled();
    });
  });

  it('displays failure message returned from onDerive', async () => {
    const onDeriveMock = vi.fn().mockResolvedValue('No se puede derivar un caso cerrado');

    render(
      <DeriveCaseModal
        doc={sampleDoc}
        currentQueueName="Cirugía General"
        onClose={vi.fn()}
        onDerive={onDeriveMock}
      />
    );

    fireEvent.change(screen.getByLabelText('Derivar a'), { target: { value: 'Cola_Oncologia' } });
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Derivación clínica por confirmación' } });

    fireEvent.submit(screen.getByRole('button', { name: /derivar/i }).closest('form')!);

    expect(await screen.findByText('No se puede derivar un caso cerrado')).toBeInTheDocument();
  });

  it('shows informational warning when selecting a non-asistencial queue', () => {
    render(
      <DeriveCaseModal
        doc={sampleDoc}
        currentQueueName="Cirugía General"
        onClose={vi.fn()}
        onDerive={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('Derivar a'), { target: { value: 'Cola_Administrativa' } });

    expect(
      screen.getByText('Esta cola no aparece en la Consola de Triaje: el caso saldrá de la consola.')
    ).toBeInTheDocument();
  });
});
