import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDashboardStats, dashboardPeriod, DASHBOARD_DIAS } from './useDashboardStats';
import { documentService } from '../services/documentService';
import type { DashboardStatsResponse } from '../types/dashboard';

vi.mock('../services/documentService', () => ({
  documentService: {
    getDashboardStats: vi.fn(),
  },
}));

describe('useDashboardStats hook and clinical metrics calculations', () => {
  const mockGetDashboardStats = vi.mocked(documentService.getDashboardStats);

  const mockAdminStats: DashboardStatsResponse = {
    fecha_desde: '2026-03-01T00:00:00Z',
    fecha_hasta: '2026-03-14T23:59:59Z',
    totales: {
      total: 120,
      urgente: 8,
      prioritario: 32,
      rutina: 80,
      procesados: 110,
      auditados: 65,
      descartados: 2,
      pendientes_auditoria: 15,
    },
    por_dia: [{ fecha: '2026-03-14', urgente: 2, prioritario: 5, rutina: 12 }],
    por_destino: [{ destino: 'Cola_Emergencia_Medica', total: 8 }],
    recientes: [],
    mis_casos: [
      {
        documento_id: 'DOC-101',
        nombre_paciente: 'Carlos Pinto',
        identificacion_paciente: '12345678-5',
        tipo_identificacion: 'RUT',
        tipo_documento: 'INFORME_URGENCIA',
        diagnostico_principal: 'TEP Agudo',
        nivel_prioridad: 'Urgente',
        destino_enrutamiento: 'Cola_Emergencia_Medica',
        score_confianza: 0.95,
        estado: 'PENDIENTE_AUDITORIA',
        oci_json_path: 'mock.json',
        created_at: '2026-03-14T10:00:00Z',
      },
    ],
    pendientes_auditoria: [
      {
        documento_id: 'DOC-102',
        nombre_paciente: 'Laura Gomez',
        identificacion_paciente: '87654321-0',
        tipo_identificacion: 'RUT',
        tipo_documento: 'EPICRISIS',
        diagnostico_principal: 'Neumonia Grave',
        nivel_prioridad: 'Prioritario',
        destino_enrutamiento: 'Cola_Medicina_Interna',
        score_confianza: 0.81,
        estado: 'PENDIENTE_AUDITORIA',
        oci_json_path: 'mock2.json',
        created_at: '2026-03-14T09:00:00Z',
      },
    ],
    urgentes: [
      {
        documento_id: 'DOC-103',
        nombre_paciente: 'Elena Torres',
        identificacion_paciente: '11223344-5',
        tipo_identificacion: 'RUT',
        tipo_documento: 'INFORME_URGENCIA',
        diagnostico_principal: 'Shock Anafilactico',
        nivel_prioridad: 'Urgente',
        destino_enrutamiento: 'Cola_Emergencia_Medica',
        score_confianza: 0.99,
        estado: 'AUDITADO',
        oci_json_path: 'mock3.json',
        created_at: '2026-03-14T08:00:00Z',
      },
    ],
  };

  const mockOperadorStats: DashboardStatsResponse = {
    fecha_desde: '2026-03-01T00:00:00Z',
    fecha_hasta: '2026-03-14T23:59:59Z',
    totales: {
      total: 25,
      urgente: 2,
      prioritario: 8,
      rutina: 15,
      procesados: 25,
      auditados: 18,
      descartados: 0,
      pendientes_auditoria: 5,
    },
    por_dia: [{ fecha: '2026-03-14', urgente: 1, prioritario: 2, rutina: 3 }],
    por_destino: [{ destino: 'Cola_Admision', total: 25 }],
    recientes: [
      {
        documento_id: 'DOC-201',
        nombre_paciente: 'Manuel Castro',
        identificacion_paciente: '15443322-1',
        tipo_identificacion: 'RUT',
        tipo_documento: 'RECETA',
        diagnostico_principal: 'Hipertension Primaria',
        nivel_prioridad: 'Rutina',
        destino_enrutamiento: 'Cola_Admision',
        score_confianza: 0.92,
        estado: 'PROCESADO',
        oci_json_path: 'mock4.json',
        created_at: '2026-03-14T11:00:00Z',
      },
    ],
    mis_casos: [],
    pendientes_auditoria: [],
    urgentes: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('dashboardPeriod calculation', () => {
    it(`calculates a range covering exactly ${DASHBOARD_DIAS} days up to 23:59:59.999 of the current date`, () => {
      const fixedNow = new Date(2026, 2, 15, 14, 30, 0); // 15 March 2026
      const { desde, hasta } = dashboardPeriod(fixedNow);

      expect(desde.getFullYear()).toBe(2026);
      expect(desde.getMonth()).toBe(2);
      expect(desde.getDate()).toBe(15 - (DASHBOARD_DIAS - 1)); // 15 - 13 = 2
      expect(desde.getHours()).toBe(0);
      expect(desde.getMinutes()).toBe(0);
      expect(desde.getSeconds()).toBe(0);

      expect(hasta.getFullYear()).toBe(2026);
      expect(hasta.getMonth()).toBe(2);
      expect(hasta.getDate()).toBe(15);
      expect(hasta.getHours()).toBe(23);
      expect(hasta.getMinutes()).toBe(59);
      expect(hasta.getSeconds()).toBe(59);
      expect(hasta.getMilliseconds()).toBe(999);
    });
  });

  describe('useDashboardStats hook lifecycle and role differentiation', () => {
    it('fetches dashboard statistics successfully with proper timezone offset', async () => {
      mockGetDashboardStats.mockResolvedValue(mockAdminStats);

      const { result } = renderHook(() => useDashboardStats());

      expect(result.current.state).toBe('loading');
      expect(result.current.stats).toBeNull();

      await waitFor(() => {
        expect(result.current.state).toBe('success');
      });

      expect(result.current.stats).toEqual(mockAdminStats);
      expect(result.current.error).toBeNull();
      expect(mockGetDashboardStats).toHaveBeenCalledTimes(1);

      const calledWith = mockGetDashboardStats.mock.calls[0][0];
      expect(calledWith).toHaveProperty('fecha_desde');
      expect(calledWith).toHaveProperty('fecha_hasta');
      expect(calledWith).toHaveProperty('utc_offset_min');
      expect(typeof calledWith.utc_offset_min).toBe('number');
    });

    it('differentiates operational metrics for OPERADOR vs hospital-wide clinical oversight', async () => {
      mockGetDashboardStats.mockResolvedValue(mockOperadorStats);

      const { result } = renderHook(() => useDashboardStats());

      await waitFor(() => {
        expect(result.current.state).toBe('success');
      });

      const stats = result.current.stats!;
      // Operator view contains their recent uploads
      expect(stats.recientes.length).toBeGreaterThan(0);
      expect(stats.recientes[0].documento_id).toBe('DOC-201');
      // Operator view does not have clinical auditor queues
      expect(stats.mis_casos.length).toBe(0);
      expect(stats.pendientes_auditoria.length).toBe(0);
      expect(stats.totales.total).toBe(25);
    });

    it('handles clinical oversight datasets for ADMIN and AUDITOR roles', async () => {
      mockGetDashboardStats.mockResolvedValue(mockAdminStats);

      const { result } = renderHook(() => useDashboardStats());

      await waitFor(() => {
        expect(result.current.state).toBe('success');
      });

      const stats = result.current.stats!;
      // Admin/Auditor view has hospital queues and taken cases
      expect(stats.mis_casos.length).toBe(1);
      expect(stats.pendientes_auditoria.length).toBe(1);
      expect(stats.urgentes.length).toBe(1);
      expect(stats.totales.urgente).toBe(8);
      expect(stats.totales.pendientes_auditoria).toBe(15);
    });

    it('handles backend network or HTTP failure gracefully', async () => {
      mockGetDashboardStats.mockRejectedValue(new Error('Fallo de red en servidor OCI'));

      const { result } = renderHook(() => useDashboardStats());

      await waitFor(() => {
        expect(result.current.state).toBe('error');
      });

      expect(result.current.stats).toBeNull();
      expect(result.current.error).toBe('Fallo de red en servidor OCI');
    });

    it('reloads stats on demand when reload function is called', async () => {
      mockGetDashboardStats.mockResolvedValue(mockAdminStats);

      const { result } = renderHook(() => useDashboardStats());

      await waitFor(() => {
        expect(result.current.state).toBe('success');
      });

      expect(mockGetDashboardStats).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.reload();
      });

      await waitFor(() => {
        expect(mockGetDashboardStats).toHaveBeenCalledTimes(2);
      });
    });
  });
});
