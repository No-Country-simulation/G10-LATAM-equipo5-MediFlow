import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TriageCaseCard from './TriageCaseCard';
import { DocumentDetailContext } from '../../context/documentDetailContext';
import type { DocumentListItemResponse } from '../../types/medical';

describe('TriageCaseCard clinical workflow and interception', () => {
  const sampleDoc: DocumentListItemResponse = {
    documento_id: 'DOC-88392100',
    nombre_paciente: 'Carmen Gloria Quintana',
    identificacion_paciente: '9283711-K',
    tipo_identificacion: 'RUT',
    tipo_documento: 'INTERCONSULTA',
    diagnostico_principal: 'Sospecha de neoplasia gástrica',
    nivel_prioridad: 'Prioritario',
    destino_enrutamiento: 'Cola_Oncologia',
    score_confianza: 0.92,
    estado: 'PROCESADO',
    oci_json_path: 'mock/path.json',
    created_at: new Date().toISOString(),
  };

  const renderWithContext = (ui: React.ReactElement, mockContext = {}) => {
    const defaultContext = {
      abrirDocumento: vi.fn(),
      notificarCambio: vi.fn(),
      revision: 0,
      ...mockContext,
    };

    return {
      ...render(
        <DocumentDetailContext.Provider value={defaultContext}>
          {ui}
        </DocumentDetailContext.Provider>
      ),
      mockContext: defaultContext,
    };
  };

  it('renders patient and clinical information clearly', () => {
    renderWithContext(
      <TriageCaseCard
        doc={sampleDoc}
        queueName="Oncología Adulto"
      />
    );

    expect(screen.getByText('Carmen Gloria Quintana')).toBeInTheDocument();
    expect(screen.getByText(/9283711-K/)).toBeInTheDocument();
    expect(screen.getByText(/DOC-88392100/)).toBeInTheDocument();
    expect(screen.getByText('Sospecha de neoplasia gástrica')).toBeInTheDocument();
    expect(screen.getByText('Oncología Adulto')).toBeInTheDocument();
    expect(screen.getByText('Prioritario')).toBeInTheDocument();
  });

  it('intercepts "Marcar atendido" to open confirmation modal instead of silently resolving', async () => {
    const user = userEvent.setup();
    const handleAttend = vi.fn();

    renderWithContext(
      <TriageCaseCard
        doc={sampleDoc}
        queueName="Oncología Adulto"
        onAttend={handleAttend}
      />
    );

    const attendButton = screen.getByRole('button', { name: /marcar atendido/i });
    expect(attendButton).toHaveAttribute('aria-haspopup', 'dialog');

    await user.click(attendButton);

    // Verifies it triggers onAttend with the full case so TriagePage can mount ConfirmAttendModal
    expect(handleAttend).toHaveBeenCalledTimes(1);
    expect(handleAttend).toHaveBeenCalledWith(sampleDoc);
  });

  it('triggers onDerive handler to route the case to DeriveCaseModal without interference', async () => {
    const user = userEvent.setup();
    const handleDerive = vi.fn();

    renderWithContext(
      <TriageCaseCard
        doc={sampleDoc}
        queueName="Oncología Adulto"
        onDerive={handleDerive}
      />
    );

    const deriveButton = screen.getByRole('button', { name: /derivar/i });
    await user.click(deriveButton);

    expect(handleDerive).toHaveBeenCalledTimes(1);
    expect(handleDerive).toHaveBeenCalledWith(sampleDoc);
  });

  it('disables action buttons when attending is true', () => {
    renderWithContext(
      <TriageCaseCard
        doc={sampleDoc}
        queueName="Oncología Adulto"
        onAttend={vi.fn()}
        onDerive={vi.fn()}
        attending={true}
      />
    );

    expect(screen.getByRole('button', { name: /marcar atendido/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /derivar/i })).toBeDisabled();
  });

  it('does not render action buttons if handlers are not passed (read-only mode)', () => {
    renderWithContext(
      <TriageCaseCard
        doc={sampleDoc}
        queueName="Oncología Adulto"
      />
    );

    expect(screen.queryByRole('button', { name: /marcar atendido/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /derivar/i })).not.toBeInTheDocument();
  });

  it('opens document detail view when clicking the card body', async () => {
    const user = userEvent.setup();
    const abrirDocumento = vi.fn();

    renderWithContext(
      <TriageCaseCard
        doc={sampleDoc}
        queueName="Oncología Adulto"
      />,
      { abrirDocumento }
    );

    const cardButton = screen.getByRole('button', { name: /ver detalle del documento DOC-88392100/i });
    await user.click(cardButton);

    expect(abrirDocumento).toHaveBeenCalledWith('DOC-88392100');
  });
});
