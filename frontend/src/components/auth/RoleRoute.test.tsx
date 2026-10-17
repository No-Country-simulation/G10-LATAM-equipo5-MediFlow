import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RoleRoute } from './RoleRoute';
import { useAuth } from '../../hooks/useAuth';
import type { UserRole } from '../../types/auth';

vi.mock('../../hooks/useAuth');

describe('RoleRoute role-based authorization guard', () => {
  const mockUseAuth = vi.mocked(useAuth);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupAuth = (role: UserRole | null, isAuthenticated = true) => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: isAuthenticated && role !== null,
      isLoading: false,
      user: role
        ? {
            id: 'u-1',
            username: `user_${role.toLowerCase()}`,
            full_name: 'Test User',
            email: 'test@hospital.org',
            role,
          }
        : null,
      token: role ? 'mock-token' : null,
      login: vi.fn(),
      logout: vi.fn(),
    });
  };

  it('redirects to /login when user is not authenticated', () => {
    setupAuth(null, false);

    render(
      <MemoryRouter initialEntries={['/auditoria']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/auditoria"
            element={
              <RoleRoute allowedRoles={['ADMIN', 'AUDITOR_CLINICO']}>
                <div>Auditoría Clínica</div>
              </RoleRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Auditoría Clínica')).not.toBeInTheDocument();
  });

  it('strictly redirects GESTOR_USUARIOS to /usuarios when attempting to access clinical routes', () => {
    setupAuth('GESTOR_USUARIOS');

    render(
      <MemoryRouter initialEntries={['/auditoria']}>
        <Routes>
          <Route path="/usuarios" element={<div>Gestión de Usuarios</div>} />
          <Route
            path="/auditoria"
            element={
              <RoleRoute allowedRoles={['ADMIN', 'AUDITOR_CLINICO']}>
                <div>Auditoría Clínica</div>
              </RoleRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Gestión de Usuarios')).toBeInTheDocument();
    expect(screen.queryByText('Auditoría Clínica')).not.toBeInTheDocument();
  });

  it('redirects unauthorized roles to specified fallbackPath when supplied', () => {
    setupAuth('OPERADOR');

    render(
      <MemoryRouter initialEntries={['/admin-config']}>
        <Routes>
          <Route path="/acceso-denegado" element={<div>Acceso Denegado</div>} />
          <Route
            path="/admin-config"
            element={
              <RoleRoute allowedRoles={['ADMIN']} fallbackPath="/acceso-denegado">
                <div>Configuración de Administración</div>
              </RoleRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Acceso Denegado')).toBeInTheDocument();
    expect(screen.queryByText('Configuración de Administración')).not.toBeInTheDocument();
  });

  it('redirects unauthorized roles to default home route when fallbackPath is not supplied', () => {
    setupAuth('OPERADOR');

    render(
      <MemoryRouter initialEntries={['/catálogos']}>
        <Routes>
          <Route path="/dashboard" element={<div>Dashboard de Inicio</div>} />
          <Route
            path="/catálogos"
            element={
              <RoleRoute allowedRoles={['ADMIN']}>
                <div>Edición de Catálogos Clínicos</div>
              </RoleRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Dashboard de Inicio')).toBeInTheDocument();
    expect(screen.queryByText('Edición de Catálogos Clínicos')).not.toBeInTheDocument();
  });

  it('renders children when the user role is authorized in allowedRoles', () => {
    setupAuth('AUDITOR_CLINICO');

    render(
      <MemoryRouter initialEntries={['/auditoria']}>
        <Routes>
          <Route
            path="/auditoria"
            element={
              <RoleRoute allowedRoles={['ADMIN', 'AUDITOR_CLINICO']}>
                <div>Auditoría Clínica Autorizada</div>
              </RoleRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Auditoría Clínica Autorizada')).toBeInTheDocument();
  });
});
