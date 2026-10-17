import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Login from './Login';
import { ApiError } from '../services/api';
import type { UserOut } from '../types/auth';

const mockNavigate = vi.fn();
let mockIsAuthenticated = false;
let mockUser: UserOut | null = null;
const mockLogin = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    user: mockUser,
    login: mockLogin,
  }),
}));

vi.mock('../components/auth/HospitalDoorsTransition', () => ({
  default: ({ isOpen, onAnimationComplete }: { isOpen: boolean; onAnimationComplete: () => void }) => {
    if (isOpen) {
      setTimeout(() => onAnimationComplete(), 0);
    }
    return <div data-testid="hospital-doors" data-open={isOpen} />;
  },
}));

vi.mock('../components/common/ContinuousEcg', () => ({
  default: () => <div data-testid="continuous-ecg" />,
}));

describe('Login page clinical workflow and error mapping', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockLogin.mockReset();
    mockIsAuthenticated = false;
    mockUser = null;
  });

  it('redirects immediately if user is already authenticated on mount', () => {
    mockIsAuthenticated = true;
    mockUser = { id: 'u-1', username: 'gestor', email: 'g@mediflow.cl', full_name: 'Gestor Usuarios', role: 'GESTOR_USUARIOS' };

    render(<Login />);

    expect(mockNavigate).toHaveBeenCalledWith('/usuarios', { replace: true });
  });

  it('maps HTTP 401 to "Credenciales incorrectas"', async () => {
    mockLogin.mockRejectedValue(new ApiError(401, 'Unauthorized'));

    render(<Login />);

    fireEvent.change(screen.getByRole('textbox', { name: /usuario/i }), { target: { value: 'bad_user' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'bad_pass' } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Credenciales incorrectas');
    });
  });

  it('maps HTTP 500 to "Error del servidor clínico"', async () => {
    mockLogin.mockRejectedValue(new ApiError(500, 'Internal Server Error'));

    render(<Login />);

    fireEvent.change(screen.getByRole('textbox', { name: /usuario/i }), { target: { value: 'user' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Error del servidor clínico');
    });
  });

  it('maps network connection failure (status 0 or 408) to "Error de conexión"', async () => {
    mockLogin.mockRejectedValue(new ApiError(0, 'Failed to fetch'));

    render(<Login />);

    fireEvent.change(screen.getByRole('textbox', { name: /usuario/i }), { target: { value: 'user' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Error de conexión');
    });
  });

  it('routes to /dashboard for clinical staff (ADMIN, AUDITOR, OPERADOR) upon successful authentication', async () => {
    mockLogin.mockResolvedValue({ id: 'u-admin', username: 'admin', email: 'a@m.cl', full_name: 'Admin User', role: 'ADMIN' });

    render(<Login />);

    fireEvent.change(screen.getByRole('textbox', { name: /usuario/i }), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

  it('routes to /usuarios for GESTOR_USUARIOS upon successful authentication', async () => {
    mockLogin.mockResolvedValue({ id: 'u-gestor', username: 'gestor', email: 'g@m.cl', full_name: 'Gestor User', role: 'GESTOR_USUARIOS' });

    render(<Login />);

    fireEvent.change(screen.getByRole('textbox', { name: /usuario/i }), { target: { value: 'gestor' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/usuarios', { replace: true });
    });
  });
});
