import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangePasswordForm } from './ChangePasswordForm';
import { authService } from '../../services/authService';
import { ApiError } from '../../services/api';

vi.mock('../../services/authService', () => ({
  authService: { changePassword: vi.fn() },
}));

const fillForm = async (user: ReturnType<typeof userEvent.setup>, confirm = 'nuevaPass456') => {
  await user.type(screen.getByLabelText(/^contraseña actual$/i), 'actualPass123');
  await user.type(screen.getByLabelText(/^nueva contraseña \(min/i), 'nuevaPass456');
  await user.type(screen.getByLabelText(/confirmar nueva contraseña/i), confirm);
  await user.click(screen.getByRole('button', { name: /actualizar contraseña/i }));
};

describe('ChangePasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('changes the password and clears the form on success', async () => {
    vi.mocked(authService.changePassword).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fillForm(user);

    expect(authService.changePassword).toHaveBeenCalledWith({
      current_password: 'actualPass123',
      new_password: 'nuevaPass456',
    });
    expect(await screen.findByText('Contraseña actualizada correctamente')).toBeInTheDocument();
    expect(screen.getByLabelText(/^contraseña actual$/i)).toHaveValue('');
  });

  it('does not call the backend when the confirmation does not match', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fillForm(user, 'otraCosa789');

    expect(await screen.findByText('Las contraseñas nuevas no coinciden')).toBeInTheDocument();
    expect(authService.changePassword).not.toHaveBeenCalled();
  });

  it('shows the backend error and keeps the typed values', async () => {
    vi.mocked(authService.changePassword).mockRejectedValueOnce(new ApiError(400, 'La contraseña actual es incorrecta'));
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fillForm(user);

    expect(await screen.findByText('La contraseña actual es incorrecta')).toBeInTheDocument();
    expect(screen.getByLabelText(/^contraseña actual$/i)).toHaveValue('actualPass123');
  });
});
