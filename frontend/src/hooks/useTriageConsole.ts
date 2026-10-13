import { useCallback, useEffect, useReducer } from 'react';
import { documentService } from '../services/documentService';
import { useRevisionDocumentos } from '../context/documentDetailContext';
import type { TriageResponse } from '../types/medical';

type LoadState = 'idle' | 'loading' | 'success' | 'error';

interface State {
  data: TriageResponse | null;
  loadState: LoadState;
  error: string | null;
}

type Action = { type: 'fetch' } | { type: 'success'; data: TriageResponse } | { type: 'error'; message: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'fetch':
      // Se conservan los casos anteriores mientras recarga: la consola no parpadea.
      return { ...state, loadState: 'loading', error: null };
    case 'success':
      return { data: action.data, loadState: 'success', error: null };
    case 'error':
      return { ...state, loadState: 'error', error: action.message };
  }
}

/** Consola de Triaje: colas visibles del usuario y sus casos activos (`GET /documents/triage`). */
export const useTriageConsole = () => {
  const [{ data, loadState, error }, dispatch] = useReducer(reducer, { data: null, loadState: 'idle', error: null });
  const [tick, reload] = useReducer((n: number) => n + 1, 0);
  // Se recarga también cuando un documento cambia desde el modal de detalle.
  const revision = useRevisionDocumentos();

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: 'fetch' });
    documentService
      .getTriage()
      .then((res) => {
        if (!cancelled) dispatch({ type: 'success', data: res });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          dispatch({ type: 'error', message: err instanceof Error ? err.message : 'Error al conectar con backend' });
        }
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

  const reloadConsole = useCallback(() => reload(), []);

  return {
    colas: data?.colas ?? [],
    cases: data?.items ?? [],
    loaded: data !== null,
    state: loadState,
    error,
    reload: reloadConsole,
  };
};
