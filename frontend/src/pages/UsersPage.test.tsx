import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import UsersPage from './UsersPage';
import type { UserResponse } from '../types/auth';

const buildUser = (id: string, username: string): UserResponse => ({
  id,
  username,
  email: `${username}@hospital.org`,
  full_name: `Usuario ${username}`,
  role: 'OPERADOR',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  area: null,
  colas: [],
});

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'me', username: 'admin', role: 'ADMIN' } }),
}));

vi.mock('../hooks/useUsersManagement', () => ({
  useUsersManagement: () => ({
    users: [buildUser('me', 'admin'), buildUser('u-2', 'operador1')],
    isLoading: false,
    error: null,
    successMessage: null,
    updatingUserId: null,
    fetchUsers: vi.fn(),
    toggleUserStatus: vi.fn(),
    createNewUser: vi.fn(),
    updateExistingUser: vi.fn(),
    resetUserPassword: vi.fn(),
    deleteUser: vi.fn(),
    dismissMessages: vi.fn(),
  }),
}));

describe('UsersPage', () => {
  it('does not list the connected user in the directory', () => {
    render(<UsersPage />);

    expect(screen.getByText('operador1')).toBeInTheDocument();
    expect(screen.queryByText('admin')).not.toBeInTheDocument();
  });
});
