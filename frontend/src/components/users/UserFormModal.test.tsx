import type { ComponentProps } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserFormModal } from './UserFormModal';
import type { UserResponse } from '../../types/auth';

vi.mock('../../hooks/useActiveAreas', () => ({
  useActiveAreas: () => ({
    areas: [
      { id: 'area-1', codigo: 'URG', nombre: 'Urgencias' },
      { id: 'area-2', codigo: 'MED_INT', nombre: 'Medicina Interna' },
    ],
    error: null,
  }),
}));

vi.mock('../../hooks/useQueuesSummary', () => ({
  useQueuesSummary: () => ({
    queues: [
      { id: 'q-1', codigo: 'Q_URG', nombre: 'Cola Urgencias', es_asistencial: true },
      { id: 'q-2', codigo: 'Q_UCI', nombre: 'Cola UCI', es_asistencial: true },
    ],
    error: null,
  }),
}));

describe('UserFormModal user management and role assignment', () => {
  const mockOnClose = vi.fn();
  const mockOnCreate = vi.fn();
  const mockOnUpdate = vi.fn();
  const mockOnResetPassword = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnCreate.mockResolvedValue(true);
    mockOnUpdate.mockResolvedValue(true);
    mockOnResetPassword.mockResolvedValue(true);
  });

  const existingUser: UserResponse = {
    id: 'user-123',
    username: 'rsoto',
    full_name: 'Dr. Roberto Soto',
    email: 'rsoto@hospital.org',
    role: 'AUDITOR_CLINICO',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    area: { id: 'area-1', codigo: 'URG', nombre: 'Urgencias' },
    colas: [{ id: 'q-1', codigo: 'Q_URG', nombre: 'Cola Urgencias', es_asistencial: true }],
  };

  const renderModal = (props: Partial<ComponentProps<typeof UserFormModal>> = {}) =>
    render(
      <UserFormModal
        currentUserRole="ADMIN"
        onClose={mockOnClose}
        onCreate={mockOnCreate}
        onUpdate={mockOnUpdate}
        onResetPassword={mockOnResetPassword}
        {...props}
      />
    );

  const fillCreationForm = (password: string) => {
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Dra. Ana Lopez' } });
    fireEvent.change(screen.getByLabelText(/usuario \(username\)/i), { target: { value: 'alopez' } });
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), { target: { value: 'alopez@hospital.org' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: password } });
  };

  it('renders creation mode with mandatory fields and password requirement', () => {
    renderModal();

    expect(screen.getByRole('heading', { name: 'Nuevo Usuario' })).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/usuario \(username\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña \(min/i)).toBeRequired();
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/rol en mediflow/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/área/i)).toBeInTheDocument();
  });

  it('validates password minimum length of 8 characters during creation', async () => {
    renderModal();

    fillCreationForm('short');
    fireEvent.change(screen.getByLabelText(/área/i), { target: { value: 'area-1' } });
    fireEvent.submit(screen.getByRole('button', { name: /crear usuario/i }));

    expect(await screen.findByText(/la contraseña debe tener al menos 8 caracteres/i)).toBeInTheDocument();
    expect(mockOnCreate).not.toHaveBeenCalled();
  });

  it('validates mandatory area selection before submitting', async () => {
    renderModal();

    fillCreationForm('Password123!');
    fireEvent.submit(screen.getByRole('button', { name: /crear usuario/i }));

    expect(await screen.findByText(/selecciona el área a la que pertenece el usuario/i)).toBeInTheDocument();
    expect(mockOnCreate).not.toHaveBeenCalled();
  });

  it('submits valid creation payload with selected queues for clinical roles', async () => {
    renderModal();

    fillCreationForm('Password123!');
    fireEvent.change(screen.getByLabelText(/rol en mediflow/i), { target: { value: 'AUDITOR_CLINICO' } });
    fireEvent.change(screen.getByLabelText(/área/i), { target: { value: 'area-1' } });
    fireEvent.click(screen.getByLabelText('Cola Urgencias'));
    fireEvent.submit(screen.getByRole('button', { name: /crear usuario/i }));

    expect(mockOnCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: 'Dra. Ana Lopez',
        username: 'alopez',
        email: 'alopez@hospital.org',
        password: 'Password123!',
        role: 'AUDITOR_CLINICO',
        area_id: 'area-1',
        cola_ids: ['q-1'],
      })
    );
    await waitFor(() => expect(mockOnClose).toHaveBeenCalled());
    expect(mockOnResetPassword).not.toHaveBeenCalled();
  });

  it('renders edit mode with disabled username and an optional password field', () => {
    renderModal({ user: existingUser });

    expect(screen.getByRole('heading', { name: 'Editar Usuario' })).toBeInTheDocument();
    const usernameInput = screen.getByLabelText(/usuario \(username\)/i);
    expect(usernameInput).toBeDisabled();
    expect(usernameInput).toHaveValue('rsoto');

    const passwordInput = screen.getByLabelText(/nueva contraseña \(opcional\)/i);
    expect(passwordInput).not.toBeRequired();
    expect(passwordInput).toHaveValue('');
    // La sección de contraseña personal se movió a Mi Perfil.
    expect(screen.queryByLabelText(/contraseña actual/i)).not.toBeInTheDocument();
  });

  it('updates user data without resetting the password when the field is left empty', async () => {
    renderModal({ user: existingUser });

    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Dr. Roberto Soto P.' } });
    fireEvent.submit(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(mockOnUpdate).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({
        full_name: 'Dr. Roberto Soto P.',
        email: 'rsoto@hospital.org',
        role: 'AUDITOR_CLINICO',
        area_id: 'area-1',
      })
    );
    await waitFor(() => expect(mockOnClose).toHaveBeenCalled());
    expect(mockOnResetPassword).not.toHaveBeenCalled();
  });

  it('resets the password of another user after saving their data', async () => {
    const user = userEvent.setup();
    renderModal({ user: existingUser });

    await user.type(screen.getByLabelText(/nueva contraseña \(opcional\)/i), 'Reestablecida123');
    fireEvent.submit(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(mockOnResetPassword).toHaveBeenCalledWith(existingUser, 'Reestablecida123'));
    expect(mockOnUpdate).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('validates the minimum length of the reset password', async () => {
    const user = userEvent.setup();
    renderModal({ user: existingUser });

    await user.type(screen.getByLabelText(/nueva contraseña \(opcional\)/i), 'corta');
    fireEvent.submit(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(await screen.findByText(/la contraseña debe tener al menos 8 caracteres/i)).toBeInTheDocument();
    expect(mockOnUpdate).not.toHaveBeenCalled();
    expect(mockOnResetPassword).not.toHaveBeenCalled();
  });

  it('does not reset the password nor close when the data update fails', async () => {
    const user = userEvent.setup();
    mockOnUpdate.mockResolvedValue(false);
    renderModal({ user: existingUser });

    await user.type(screen.getByLabelText(/nueva contraseña \(opcional\)/i), 'Reestablecida123');
    fireEvent.submit(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(mockOnUpdate).toHaveBeenCalled());
    expect(mockOnResetPassword).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('keeps the modal open when the password reset fails', async () => {
    const user = userEvent.setup();
    mockOnResetPassword.mockResolvedValue(false);
    renderModal({ user: existingUser });

    await user.type(screen.getByLabelText(/nueva contraseña \(opcional\)/i), 'Reestablecida123');
    fireEvent.submit(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(mockOnResetPassword).toHaveBeenCalled());
    expect(mockOnClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeEnabled();
  });

  it('restricts ADMIN role option when creator is GESTOR_USUARIOS', () => {
    renderModal({ currentUserRole: 'GESTOR_USUARIOS' });

    const roleSelect = screen.getByLabelText(/rol en mediflow/i);
    const options = Array.from(roleSelect.querySelectorAll('option')).map((opt) => opt.value);

    expect(options).toContain('AUDITOR_CLINICO');
    expect(options).toContain('OPERADOR');
    expect(options).toContain('GESTOR_USUARIOS');
    expect(options).not.toContain('ADMIN');
  });

  it('allows ADMIN role option when current user is ADMIN', () => {
    renderModal();

    const roleSelect = screen.getByLabelText(/rol en mediflow/i);
    const options = Array.from(roleSelect.querySelectorAll('option')).map((opt) => opt.value);

    expect(options).toContain('ADMIN');
    expect(options).toContain('AUDITOR_CLINICO');
    expect(options).toContain('OPERADOR');
    expect(options).toContain('GESTOR_USUARIOS');
  });

  it('toggles password visibility when clicking eye button in create mode', async () => {
    const user = userEvent.setup();
    renderModal();

    const passwordInput = screen.getByPlaceholderText('••••••••');
    expect(passwordInput).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: /ver contraseña/i }));

    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /ocultar contraseña/i })).toBeInTheDocument();
  });
});
