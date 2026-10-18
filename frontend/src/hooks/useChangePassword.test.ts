import { describe, it, expect } from 'vitest';
import { validatePasswordChange } from './useChangePassword';

const valid = { current_password: 'actualPass123', new_password: 'nuevaPass456', confirm_password: 'nuevaPass456' };

describe('validatePasswordChange', () => {
  it('accepts a valid form', () => {
    expect(validatePasswordChange(valid)).toBeNull();
  });

  it('requires the current password', () => {
    expect(validatePasswordChange({ ...valid, current_password: '' })).toBe('Ingresa tu contraseña actual');
  });

  it('requires at least 8 characters for the new password', () => {
    expect(validatePasswordChange({ ...valid, new_password: 'corta', confirm_password: 'corta' })).toMatch(
      /al menos 8 caracteres/
    );
  });

  it('rejects a new password equal to the current one', () => {
    expect(
      validatePasswordChange({ ...valid, new_password: valid.current_password, confirm_password: valid.current_password })
    ).toMatch(/distinta de la actual/);
  });

  it('requires the confirmation to match', () => {
    expect(validatePasswordChange({ ...valid, confirm_password: 'otraCosa789' })).toBe('Las contraseñas nuevas no coinciden');
  });
});
