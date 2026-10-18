import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProfilePage from './ProfilePage';
import type { UserOut } from '../types/auth';

const mockUser: UserOut = {
  id: 'user-1',
  username: 'rsoto',
  email: 'rsoto@hospital.org',
  full_name: 'Dr. Roberto Soto',
  role: 'AUDITOR_CLINICO',
  area: { id: 'area-1', codigo: 'URG', nombre: 'Urgencias' },
  colas: [{ id: 'q-1', codigo: 'Q_URG', nombre: 'Cola Urgencias', es_asistencial: true }],
};

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../services/authService', () => ({
  authService: { changePassword: vi.fn() },
}));

describe('ProfilePage', () => {
  it('shows the connected user data and the password change form', () => {
    render(<ProfilePage />);

    expect(screen.getByRole('heading', { name: /mi perfil/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dr. Roberto Soto' })).toBeInTheDocument();
    expect(screen.getByText('rsoto')).toBeInTheDocument();
    expect(screen.getByText('rsoto@hospital.org')).toBeInTheDocument();
    expect(screen.getByText('Urgencias')).toBeInTheDocument();
    expect(screen.getByText('Cola Urgencias')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /cambiar contraseña/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^contraseña actual$/i)).toBeRequired();
  });
});
