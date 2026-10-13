import { useCallback, useEffect, useReducer } from 'react';
import { documentService } from '../services/documentService';
import { useRevisionDocumentos } from '../context/documentDetailContext';
import type { DashboardStatsResponse } from '../types/dashboard';

/** Días que cubren los KPIs y gráficos del inicio (incluye hoy). */
export const DASHBOARD_DIAS = 14;

type LoadState = 'idle' | 'loading' | 'success' | 'error';

interface State {
  stats: DashboardStatsResponse | null;
  loadState: LoadState;
  error: string | null;
}

type Action =
  | { type: 'fetch' }
  | { type: 'success'; stats: DashboardStatsResponse }
  | { type: 'error'; message: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'fetch':
      // Se conservan los datos anteriores mientras recarga: el inicio no parpadea.
      return { ...state, loadState: 'loading', error: null };
    case 'success':
      return { stats: action.stats, loadState: 'success', error: null };
    case 'error':
      return { ...state, loadState: 'error', error: action.message };
  }
}

/** Período del inicio: desde las 00:00 de hace `DASHBOARD_DIAS - 1` días hasta el fin de hoy (hora local). */
export function dashboardPeriod(now: Date = new Date()): { desde: Date; hasta: Date } {
  const desde = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (DASHBOARD_DIAS - 1));
  const hasta = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { desde, hasta };
}

export const useDashboardStats = () => {
  const [{ stats, loadState, error }, dispatch] = useReducer(reducer, {
    stats: null,
    loadState: 'idle',
    error: null,
  });
  const [tick, reload] = useReducer((n: number) => n + 1, 0);
  // Se recarga también cuando se corrige un documento desde el modal de detalle.
  const revision = useRevisionDocumentos();

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: 'fetch' });
    const { desde, hasta } = dashboardPeriod();

    documentService
      .getDashboardStats({
        fecha_desde: desde.toISOString(),
        fecha_hasta: hasta.toISOString(),
        utc_offset_min: -new Date().getTimezoneOffset(),
      })
      .then((res) => {
        if (!cancelled) dispatch({ type: 'success', stats: res });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        dispatch({
          type: 'error',
          message: err instanceof Error ? err.message : 'Error al conectar con backend',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [tick, revision]);

  useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState === 'visible') reload();
    };
    window.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const reloadStats = useCallback(() => reload(), []);

  return { stats, state: loadState, error, reload: reloadStats };
};
