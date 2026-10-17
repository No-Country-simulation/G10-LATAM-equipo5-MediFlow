import { describe, it, expect } from 'vitest';
import {
  cleanRut,
  calculateDv,
  validateRut,
  validarRut,
  formatRut,
  formatearRut,
  formatIdentificacion,
} from './identificacion';

describe('identificacion and Chilean RUT business logic', () => {
  describe('cleanRut (limpieza y normalización de RUT)', () => {
    it('removes dots, hyphens, spaces, and capitalizes verifier digit K', () => {
      expect(cleanRut(' 12.345.678-k ')).toBe('12345678K');
      expect(cleanRut('11.111.111-1')).toBe('111111111');
      expect(cleanRut('7654321-k')).toBe('7654321K');
    });

    it('returns empty string when input is null, undefined, or empty', () => {
      expect(cleanRut('')).toBe('');
      expect(cleanRut(null)).toBe('');
      expect(cleanRut(undefined)).toBe('');
    });
  });

  describe('calculateDv (cálculo de dígito verificador Módulo 11)', () => {
    it('calculates numeric verifier digits correctly', () => {
      expect(calculateDv(12345678)).toBe('5');
      expect(calculateDv('11111111')).toBe('1');
      expect(calculateDv('11837994')).toBe('2');
    });

    it('returns K when remainder is 10', () => {
      // 11111112: 2*2 + 1*3 + 1*4 + 1*5 + 1*6 + 1*7 + 1*2 + 1*3 = 34. 34 % 11 = 1. 11 - 1 = 10 -> 'K'
      expect(calculateDv('11111112')).toBe('K');
      expect(calculateDv('6')).toBe('K');
      expect(calculateDv('23')).toBe('K');
    });

    it('returns 0 when remainder is 11', () => {
      // 14: 4*2 + 1*3 = 11. 11 % 11 = 0 -> 11 - 0 = 11 -> '0'
      expect(calculateDv('14')).toBe('0');
    });
  });

  describe('validateRut (validación Módulo 11)', () => {
    it('validates Chilean RUT with dots, hyphens, and numeric DV', () => {
      expect(validateRut('12.345.678-5')).toBe(true);
      expect(validateRut('11.111.111-1')).toBe(true);
      expect(validateRut('11837994-2')).toBe(true);
    });

    it('validates Chilean RUT without dots and with lowercase/uppercase k', () => {
      expect(validateRut('11.111.112-k')).toBe(true);
      expect(validateRut('11.111.112-K')).toBe(true);
      expect(validateRut('11111112k')).toBe(true);
      expect(validateRut('11111112K')).toBe(true);
      expect(validateRut('6-k')).toBe(true);
      expect(validateRut('123456785')).toBe(true);
    });

    it('rejects incorrect verifier digits', () => {
      expect(validateRut('12.345.678-9')).toBe(false);
      expect(validateRut('11.111.111-2')).toBe(false);
      expect(validateRut('10000005-4')).toBe(false);
    });

    it('rejects invalid formats, letters in body, empty strings, and null/undefined', () => {
      expect(validateRut('')).toBe(false);
      expect(validateRut(null)).toBe(false);
      expect(validateRut(undefined)).toBe(false);
      expect(validateRut('abc-1')).toBe(false);
      expect(validateRut('12.34A.678-5')).toBe(false);
      expect(validateRut('5')).toBe(false);
    });

    it('validarRut alias functions identically to validateRut', () => {
      expect(validarRut('12.345.678-5')).toBe(true);
      expect(validarRut('12.345.678-9')).toBe(false);
    });
  });

  describe('formatRut (formateo asistencial de RUT)', () => {
    it('formats unformatted RUT into standard dot-and-hyphen notation', () => {
      expect(formatRut('123456785')).toBe('12.345.678-5');
      expect(formatRut('10000005k')).toBe('10.000.005-K');
    });

    it('formats RUT without dots when withDots is false', () => {
      expect(formatRut('12.345.678-5', false)).toBe('12345678-5');
      expect(formatRut('10000005k', false)).toBe('10000005-K');
    });

    it('handles already formatted RUT strings idempotently', () => {
      expect(formatRut('12.345.678-5')).toBe('12.345.678-5');
    });

    it('returns trimmed original or empty string on short/invalid inputs', () => {
      expect(formatRut('')).toBe('');
      expect(formatRut('1')).toBe('1');
      expect(formatRut(null)).toBe('');
    });

    it('formatearRut alias functions identically to formatRut', () => {
      expect(formatearRut('123456785')).toBe('12.345.678-5');
    });
  });

  describe('formatIdentificacion', () => {
    it('prepends identification type when type is given and not OTRO', () => {
      expect(formatIdentificacion('12345678-5', 'RUT')).toBe('RUT 12345678-5');
      expect(formatIdentificacion('PAS998877', 'PASAPORTE')).toBe('PASAPORTE PAS998877');
    });

    it('displays only number when type is OTRO or null/undefined', () => {
      expect(formatIdentificacion('99999999', 'OTRO')).toBe('99999999');
      expect(formatIdentificacion('99999999', null)).toBe('99999999');
    });

    it('returns default fallback when number is missing', () => {
      expect(formatIdentificacion(null)).toBe('Sin identificación');
      expect(formatIdentificacion('', 'RUT')).toBe('Sin identificación');
      expect(formatIdentificacion(undefined, 'RUT', 'No informado')).toBe('No informado');
    });
  });
});
