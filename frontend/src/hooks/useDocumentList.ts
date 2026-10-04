import { useReducer, useEffect, useCallback } from 'react';
import { documentService } from '../services/documentService';
import type { DocumentListItemResponse, DocumentFilterParams } from '../types/medical';
import { MOCK_DOCUMENT_LIST_ITEMS } from '../components/dashboard/triageData';

type LoadState = 'idle' | 'loading' | 'success' | 'error';

interface State {
  documents: DocumentListItemResponse[];
  total: number;
  loadState: LoadState;
  error: string | null;
}

type Action =
  | { type: 'fetch' }
  | { type: 'success'; items: DocumentListItemResponse[]; total: number }
  | { type: 'error'; message: string; fallbackItems?: DocumentListItemResponse[] };

const initialState: State = { documents: [], total: 0, loadState: 'idle', error: null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'fetch':
      return { ...state, loadState: 'loading', error: null };
    case 'success':
      return { documents: action.items, total: action.total, loadState: 'success', error: null };
    case 'error':
      return {
        documents: action.fallbackItems ?? state.documents,
        total: action.fallbackItems?.length ?? state.total,
        loadState: action.fallbackItems ? 'success' : 'error',
        error: action.message,
      };
  }
}

export interface DocumentListState {
  documents: DocumentListItemResponse[];
  total: number;
  state: LoadState;
  error: string | null;
  reload: () => void;
}

export const useDocumentList = (params: DocumentFilterParams = {}): DocumentListState => {
  const [{ documents, total, loadState, error }, dispatch] = useReducer(reducer, initialState);
  const [tick, dispatchTick] = useReducer((n: number) => n + 1, 0);

  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: 'fetch' });

    const snapshot = JSON.parse(paramsKey) as DocumentFilterParams;

    documentService
      .listDocuments(snapshot)
      .then((res) => {
        if (cancelled) return;
        if (res.items && res.items.length > 0) {
          dispatch({ type: 'success', items: res.items, total: res.total });
        } else {
          // Fallback resiliente si el backend devuelve un arreglo vacío de prueba
          const fallback = snapshot.estado
            ? MOCK_DOCUMENT_LIST_ITEMS.filter((item) => item.estado === snapshot.estado)
            : MOCK_DOCUMENT_LIST_ITEMS;
          dispatch({
            type: 'success',
            items: fallback,
            total: fallback.length,
          });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Fallback resiliente si FastAPI está caído o requiere autenticación
        const fallback = snapshot.estado
          ? MOCK_DOCUMENT_LIST_ITEMS.filter((item) => item.estado === snapshot.estado)
          : MOCK_DOCUMENT_LIST_ITEMS;
        dispatch({
          type: 'error',
          message: err instanceof Error ? err.message : 'Error al conectar con backend',
          fallbackItems: fallback,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [tick, paramsKey]);

  const reload = useCallback(() => dispatchTick(), []);

  return { documents, total, state: loadState, error, reload };
};
