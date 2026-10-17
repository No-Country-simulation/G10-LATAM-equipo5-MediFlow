import { describe, it, expect } from 'vitest';
import {
  toInputDate,
  resolveDateRange,
  DATE_PRESET_OPTIONS,
} from './dateRange';

describe('dateRange clinical filtering utilities', () => {
  const fixedNow = new Date(2026, 4, 15, 16, 20, 0); // 15 May 2026

  describe('DATE_PRESET_OPTIONS', () => {
    it('contains standard options including HOY, ULTIMOS_7, MES_ACTUAL, MES_ANTERIOR, and RANGO', () => {
      const ids = DATE_PRESET_OPTIONS.map((opt) => opt.id);
      expect(ids).toContain('HOY');
      expect(ids).toContain('ULTIMOS_7');
      expect(ids).toContain('MES_ACTUAL');
      expect(ids).toContain('MES_ANTERIOR');
      expect(ids).toContain('RANGO');
    });
  });

  describe('toInputDate', () => {
    it('formats dates into YYYY-MM-DD local format for HTML5 date inputs', () => {
      const date = new Date(2026, 0, 5); // 5 Jan 2026
      expect(toInputDate(date)).toBe('2026-01-05');

      const endOfYear = new Date(2026, 11, 31); // 31 Dec 2026
      expect(toInputDate(endOfYear)).toBe('2026-12-31');
    });
  });

  describe('resolveDateRange preset calculations', () => {
    it('calculates HOY preset as beginning of today (00:00:00.000) to end of today (23:59:59.999)', () => {
      const { from, to } = resolveDateRange('HOY', '', '', fixedNow);

      expect(from).not.toBeNull();
      expect(to).not.toBeNull();
      expect(from!.getFullYear()).toBe(2026);
      expect(from!.getMonth()).toBe(4);
      expect(from!.getDate()).toBe(15);
      expect(from!.getHours()).toBe(0);
      expect(from!.getMinutes()).toBe(0);
      expect(from!.getSeconds()).toBe(0);
      expect(from!.getMilliseconds()).toBe(0);

      expect(to!.getFullYear()).toBe(2026);
      expect(to!.getMonth()).toBe(4);
      expect(to!.getDate()).toBe(15);
      expect(to!.getHours()).toBe(23);
      expect(to!.getMinutes()).toBe(59);
      expect(to!.getSeconds()).toBe(59);
      expect(to!.getMilliseconds()).toBe(999);
    });

    it('calculates ULTIMOS_7 and ULTIMOS_7_DIAS preset across a 7-day span ending today', () => {
      const res1 = resolveDateRange('ULTIMOS_7', '', '', fixedNow);
      const res2 = resolveDateRange('ULTIMOS_7_DIAS', '', '', fixedNow);

      [res1, res2].forEach(({ from, to }) => {
        expect(from).not.toBeNull();
        expect(to).not.toBeNull();
        // 15 - 6 = 9 May
        expect(from!.getFullYear()).toBe(2026);
        expect(from!.getMonth()).toBe(4);
        expect(from!.getDate()).toBe(9);
        expect(from!.getHours()).toBe(0);
        expect(from!.getMinutes()).toBe(0);

        expect(to!.getFullYear()).toBe(2026);
        expect(to!.getMonth()).toBe(4);
        expect(to!.getDate()).toBe(15);
        expect(to!.getHours()).toBe(23);
        expect(to!.getMinutes()).toBe(59);
      });
    });

    it('calculates MES_ACTUAL preset starting from day 1 of current month until end of today', () => {
      const { from, to } = resolveDateRange('MES_ACTUAL', '', '', fixedNow);

      expect(from).not.toBeNull();
      expect(to).not.toBeNull();
      expect(from!.getFullYear()).toBe(2026);
      expect(from!.getMonth()).toBe(4);
      expect(from!.getDate()).toBe(1);

      expect(to!.getFullYear()).toBe(2026);
      expect(to!.getMonth()).toBe(4);
      expect(to!.getDate()).toBe(15);
      expect(to!.getHours()).toBe(23);
      expect(to!.getMinutes()).toBe(59);
    });

    it('calculates MES_ANTERIOR preset covering the full previous month', () => {
      const { from, to } = resolveDateRange('MES_ANTERIOR', '', '', fixedNow);

      expect(from).not.toBeNull();
      expect(to).not.toBeNull();
      // Previous month is April (month index 3)
      expect(from!.getFullYear()).toBe(2026);
      expect(from!.getMonth()).toBe(3);
      expect(from!.getDate()).toBe(1);

      // April has 30 days
      expect(to!.getFullYear()).toBe(2026);
      expect(to!.getMonth()).toBe(3);
      expect(to!.getDate()).toBe(30);
      expect(to!.getHours()).toBe(23);
      expect(to!.getMinutes()).toBe(59);
      expect(to!.getSeconds()).toBe(59);
    });

    it('calculates RANGO preset with custom from and to date strings', () => {
      const { from, to } = resolveDateRange('RANGO', '2026-02-10', '2026-02-20', fixedNow);

      expect(from).not.toBeNull();
      expect(to).not.toBeNull();
      expect(from!.getFullYear()).toBe(2026);
      expect(from!.getMonth()).toBe(1);
      expect(from!.getDate()).toBe(10);
      expect(from!.getHours()).toBe(0);

      expect(to!.getFullYear()).toBe(2026);
      expect(to!.getMonth()).toBe(1);
      expect(to!.getDate()).toBe(20);
      expect(to!.getHours()).toBe(23);
      expect(to!.getMinutes()).toBe(59);
    });

    it('returns null boundaries in RANGO preset when custom date inputs are empty or invalid', () => {
      const { from, to } = resolveDateRange('RANGO', '', '', fixedNow);
      expect(from).toBeNull();
      expect(to).toBeNull();

      const invalidRes = resolveDateRange('RANGO', 'invalid-date', '', fixedNow);
      expect(invalidRes.from).toBeNull();
    });
  });
});
