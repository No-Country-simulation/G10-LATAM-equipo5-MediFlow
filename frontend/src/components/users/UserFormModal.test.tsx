import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnCreate.mockResolvedValue(true);
    mockOnUpdate.mockResolvedValue(true);
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

  it('renders creation mode with mandatory fields and password requirement', () => {
    render(
      <UserFormModal
        currentUserRole="ADMIN"
        onClose={mockOnClose}
        onCreate={mockOnCreate}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByRole('heading', { name: 'Nuevo Usuario' })).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/usuario \(username\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña \(min/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/rol en mediflow/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/área/i)).toBeInTheDocument();
  });

  it('validates password minimum length of 8 characters during creation', async () => {
    render(
      <UserFormModal
        currentUserRole="ADMIN"
        onClose={mockOnClose}
        onCreate={mockOnCreate}
        onUpdate={mockOnUpdate}
      />
    );

    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Dra. Ana Lopez' } });
    fireEvent.change(screen.getByLabelText(/usuario \(username\)/i), { target: { value: 'alopez' } });
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), { target: { value: 'alopez@hospital.org' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText(/área/i), { target: { value: 'area-1' } });

    fireEvent.submit(screen.getByRole('button', { name: /crear usuario/i }));

    expect(await screen.findByText(/la contraseña debe tener al menos 8 caracteres/i)).toBeInTheDocument();
    expect(mockOnCreate).not.toHaveBeenCalled();
  });

  it('validates mandatory area selection before submitting', async () => {
    render(
      <UserFormModal
        currentUserRole="ADMIN"
        onClose={mockOnClose}
        onCreate={mockOnCreate}
        onUpdate={mockOnUpdate}
      />
    );

    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Dra. Ana Lopez' } });
    fireEvent.change(screen.getByLabelText(/usuario \(username\)/i), { target: { value: 'alopez' } });
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), { target: { value: 'alopez@hospital.org' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'Password123!' } });

    fireEvent.submit(screen.getByRole('button', { name: /crear usuario/i }));

    expect(await screen.findByText(/selecciona el área a la que pertenece el usuario/i)).toBeInTheDocument();
    expect(mockOnCreate).not.toHaveBeenCalled();
  });

  it('submits valid creation payload with selected queues for clinical roles', async () => {
    render(
      <UserFormModal
        currentUserRole="ADMIN"
        onClose={mockOnClose}
        onCreate={mockOnCreate}
        onUpdate={mockOnUpdate}
      />
    );

    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Dra. Ana Lopez' } });
    fireEvent.change(screen.getByLabelText(/usuario \(username\)/i), { target: { value: 'alopez' } });
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), { target: { value: 'alopez@hospital.org' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByLabelText(/rol en mediflow/i), { target: { value: 'AUDITOR_CLINICO' } });
    fireEvent.change(screen.getByLabelText(/área/i), { target: { value: 'area-1' } });

    // Select queue
    const queueCheckbox = screen.getByLabelText('Cola Urgencias');
    fireEvent.click(queueCheckbox);

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
  });

  it('renders edit mode with disabled username, without password field, and triggers onUpdate', () => {
    render(
      <UserFormModal
        user={existingUser}
        currentUserRole="ADMIN"
        onClose={mockOnClose}
        onCreate={mockOnCreate}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByRole('heading', { name: 'Editar Usuario' })).toBeInTheDocument();
    const usernameInput = screen.getByLabelText(/usuario \(username\)/i);
    expect(usernameInput).toBeDisabled();
    expect(usernameInput).toHaveValue('rsoto');

    // Password input is omitted in edit mode
    expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument();

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
  });

  it('restricts ADMIN role option when creator is GESTOR_USUARIOS', () => {
    render(
      <UserFormModal
        currentUserRole="GESTOR_USUARIOS"
        onClose={mockOnClose}
        onCreate={mockOnCreate}
        onUpdate={mockOnUpdate}
      />
    );

    const roleSelect = screen.getByLabelText(/rol en mediflow/i);
    const options = Array.from(roleSelect.querySelectorAll('option')).map((opt) => opt.value);

    expect(options).toContain('AUDITOR_CLINICO');
    expect(options).toContain('OPERADOR');
    expect(options).toContain('GESTOR_USUARIOS');
    expect(options).not.toContain('ADMIN');
  });

  it('allows ADMIN role option when current user is ADMIN', () => {
    render(
      <UserFormModal
        currentUserRole="ADMIN"
        onClose={mockOnClose}
        onCreate={mockOnCreate}
        onUpdate={mockOnUpdate}
      />
    );

    const roleSelect = screen.getByLabelText(/rol en mediflow/i);
    const options = Array.from(roleSelect.querySelectorAll('option')).map((opt) => opt.value);

    expect(options).toContain('ADMIN');
    expect(options).toContain('AUDITOR_CLINICO');
    expect(options).toContain('OPERADOR');
    expect(options).toContain('GESTOR_USUARIOS');
  });

  it('toggles password visibility when clicking eye button in create mode', async () => {
    const user = userEvent.setup();
    render(
      <UserFormModal
        currentUserRole="ADMIN"
        onClose={mockOnClose}
        onCreate={mockOnCreate}
        onUpdate={mockOnUpdate}
      />
    );

    const passwordInput = screen.getByPlaceholderText('••••••••');
    expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleBtn = screen.getByRole('button', { name: /ver contraseña/i });
    await user.click(toggleBtn);

    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /ocultar contraseña/i })).toBeInTheDocument();
  });
});
