import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { invalidateActiveCatalogs, useCatalogs } from './useCatalogs';
import { documentService } from '../services/documentService';

vi.mock('../services/documentService', () => ({
  documentService: { getActiveQueues: vi.fn(), getActiveDocumentTypes: vi.fn() },
}));

const QUEUES = [{ codigo: 'Ficha_Clinica', nombre: 'Ficha Clínica', descripcion_semantica: '' }];
const TYPES = [{ codigo: 'ATENCION_URGENCIA', nombre: 'Dato de Atención de Urgencia', descripcion: null }];

describe('useCatalogs shared cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateActiveCatalogs();
    vi.mocked(documentService.getActiveQueues).mockResolvedValue(QUEUES);
    vi.mocked(documentService.getActiveDocumentTypes).mockResolvedValue(TYPES);
  });

  it('loads the catalogs once for every component that uses them', async () => {
    const first = renderHook(() => useCatalogs());
    const second = renderHook(() => useCatalogs());

    await waitFor(() => expect(first.result.current.loading).toBe(false));
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(first.result.current.documentTypes).toEqual(TYPES);
    expect(second.result.current.queues).toEqual(QUEUES);
    expect(documentService.getActiveQueues).toHaveBeenCalledTimes(1);
    expect(documentService.getActiveDocumentTypes).toHaveBeenCalledTimes(1);
  });

  it('reloads after the catalog is invalidated (an ADMIN edited it)', async () => {
    const first = renderHook(() => useCatalogs());
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    invalidateActiveCatalogs();
    const second = renderHook(() => useCatalogs());
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(documentService.getActiveQueues).toHaveBeenCalledTimes(2);
  });

  it('does not keep a failed load: the next use retries', async () => {
    vi.mocked(documentService.getActiveQueues).mockRejectedValueOnce(new Error('Sin conexión'));
    const failed = renderHook(() => useCatalogs());
    await waitFor(() => expect(failed.result.current.error).toBe('Sin conexión'));

    const retried = renderHook(() => useCatalogs());
    await waitFor(() => expect(retried.result.current.queues).toEqual(QUEUES));
    expect(documentService.getActiveQueues).toHaveBeenCalledTimes(2);
  });
});
