import { useReducer, useEffect, useCallback } from 'react';
import { documentService } from '../services/documentService';
import type { DocumentListItemResponse, DocumentFilterParams } from '../types/medical';

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
  | { type: 'error'; message: string };

const initialState: State = { documents: [], total: 0, loadState: 'idle', error: null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'fetch':
      return { ...state, loadState: 'loading', error: null };
    case 'success':
      return { documents: action.items, total: action.total, loadState: 'success', error: null };
    case 'error':
      return { ...state, loadState: 'error', error: action.message };
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
        if (!cancelled) dispatch({ type: 'success', items: res.items, total: res.total });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          dispatch({
            type: 'error',
            message: err instanceof Error ? err.message : 'Error al cargar los documentos',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tick, paramsKey]);

  const reload = useCallback(() => dispatchTick(), []);

  return { documents, total, state: loadState, error, reload };
};
