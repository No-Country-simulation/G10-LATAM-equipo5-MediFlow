import type { TriageDocument } from '../types/triage';

export interface TriageState {
  documents: TriageDocument[];
  loading: boolean;
  error: string | null;
}

export type TriageAction =
  | { type: 'fetch' }
  | { type: 'success'; items: TriageDocument[] }
  | { type: 'error'; message: string };

export const initialTriageState: TriageState = {
  documents: [],
  loading: true,
  error: null,
};

export function triageReducer(state: TriageState, action: TriageAction): TriageState {
  switch (action.type) {
    case 'fetch':
      return { ...state, loading: true, error: null };
    case 'success':
      return { documents: action.items, loading: false, error: null };
    case 'error':
      return { documents: [], loading: false, error: action.message };
  }
}
