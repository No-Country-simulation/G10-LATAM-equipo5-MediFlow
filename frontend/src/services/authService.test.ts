import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from './authService';
import { api } from './api';
import { FASTAPI_ENDPOINTS } from '@/config/api';

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  getStoredToken: vi.fn().mockReturnValue('mock-token'),
  getStoredRefreshToken: vi.fn().mockReturnValue('mock-refresh-token'),
  ensureFreshToken: vi.fn().mockResolvedValue('mock-fresh-token'),
}));

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls POST /users/me/change-password with PasswordChangeRequest payload', async () => {
    const mockPost = vi.mocked(api.post);
    mockPost.mockResolvedValueOnce(undefined);

    const payload = {
      current_password: 'oldPassword123',
      new_password: 'newPassword456',
    };

    await authService.changePassword(payload);

    expect(mockPost).toHaveBeenCalledWith(
      FASTAPI_ENDPOINTS.users.changePassword,
      payload
    );
    expect(FASTAPI_ENDPOINTS.users.changePassword).toBe('/users/me/change-password');
  });
});
