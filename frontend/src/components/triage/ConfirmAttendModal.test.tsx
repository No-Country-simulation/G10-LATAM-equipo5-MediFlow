import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmAttendModal } from './ConfirmAttendModal';
import type { DocumentListItemResponse } from '../../types/medical';

describe('ConfirmAttendModal clinical safety', () => {
  const urgentCase: DocumentListItemResponse = {
    documento_id: 'DOC-11837994',
    nombre_paciente: 'Roberto Carlos Plaza Valenzuela',
    identificacion_paciente: '11837994-2',
    tipo_identificacion: 'RUT',
    tipo_documento: 'INFORME_URGENCIA',
    diagnostico_principal: 'Accidente cerebrovascular (ACV) agudo en evolución',
    nivel_prioridad: 'Urgente',
    destino_enrutamiento: 'Cola_Emergencia_Medica',
    score_confianza: 0.98,
    estado: 'PROCESADO',
    oci_json_path: 'mock/path.json',
    created_at: new Date().toISOString(),
  };

  it('renders nothing when isOpen is false or caseItem is null', () => {
    const { rerender } = render(
      <ConfirmAttendModal
        isOpen={false}
        caseItem={urgentCase}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(
      <ConfirmAttendModal
        isOpen={true}
        caseItem={null}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('displays critical clinical patient data to prevent medical mistakes', () => {
    render(
      <ConfirmAttendModal
        isOpen={true}
        caseItem={urgentCase}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Confirmar Atención de Caso' })).toBeInTheDocument();
    // Patient name visible
    expect(screen.getByText('Roberto Carlos Plaza Valenzuela')).toBeInTheDocument();
    // Patient ID and document code
    expect(screen.getByText(/11837994-2/)).toBeInTheDocument();
    expect(screen.getAllByText(/DOC-11837994/).length).toBeGreaterThanOrEqual(1);
    // Diagnostic
    expect(screen.getByText('Accidente cerebrovascular (ACV) agudo en evolución')).toBeInTheDocument();
    // Priority badge
    expect(screen.getByText('Urgente')).toBeInTheDocument();
    // Urgent clinical banner
    expect(screen.getByText(/Caso Urgente:/i)).toBeInTheDocument();
  });

  it('safe cancellation: clicking Cancel calls onClose and never calls onConfirm', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const handleConfirm = vi.fn();

    render(
      <ConfirmAttendModal
        isOpen={true}
        caseItem={urgentCase}
        onConfirm={handleConfirm}
        onClose={handleClose}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: 'Cancelar' });
    await user.click(cancelBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(handleConfirm).toHaveBeenCalledTimes(0);
  });

  it('explicit confirmation: clicking Confirm calls onConfirm exactly once with case id', async () => {
    const user = userEvent.setup();
    const handleConfirm = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <ConfirmAttendModal
        isOpen={true}
        caseItem={urgentCase}
        onConfirm={handleConfirm}
        onClose={handleClose}
      />
    );

    const confirmBtn = screen.getByRole('button', { name: 'Confirmar atención' });
    await user.click(confirmBtn);

    expect(handleConfirm).toHaveBeenCalledTimes(1);
    expect(handleConfirm).toHaveBeenCalledWith('DOC-11837994');
  });

  it('double-click protection (loading state): disables action buttons during transit', () => {
    render(
      <ConfirmAttendModal
        isOpen={true}
        caseItem={urgentCase}
        loading={true}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: 'Cancelar' });
    const confirmBtn = screen.getByRole('button', { name: 'Confirmar atención' });

    expect(cancelBtn).toBeDisabled();
    expect(confirmBtn).toBeDisabled();
  });

  it('displays error status banner when confirmation fails', async () => {
    const user = userEvent.setup();
    const handleConfirm = vi.fn().mockRejectedValue(new Error('Fallo de conexión con el servidor asistencial'));

    render(
      <ConfirmAttendModal
        isOpen={true}
        caseItem={urgentCase}
        onConfirm={handleConfirm}
        onClose={vi.fn()}
      />
    );

    const confirmBtn = screen.getByRole('button', { name: 'Confirmar atención' });
    await user.click(confirmBtn);

    expect(await screen.findByText('Fallo de conexión con el servidor asistencial')).toBeInTheDocument();
  });
});
