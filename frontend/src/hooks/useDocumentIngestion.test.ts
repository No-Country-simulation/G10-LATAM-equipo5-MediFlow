import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDocumentIngestion } from './useDocumentIngestion';
import * as ingestionService from '../services/ingestionService';
import { IngestionError, type N8nIngestResponse } from '../types/ingestion';

vi.mock('../services/documentService', () => ({
  documentService: {
    checkDuplicateFiles: vi.fn().mockResolvedValue({ coincidencias: [] }),
  },
}));

describe('useDocumentIngestion state machine hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes in idle state', () => {
    const { result } = renderHook(() => useDocumentIngestion());

    expect(result.current.selectedFile).toBeNull();
    expect(result.current.confirmPending).toBe(false);
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.failure).toBeNull();
    expect(result.current.duplicados).toEqual([]);
  });

  it('rejects invalid files immediately and sets failure without transitioning to confirmPending', () => {
    const { result } = renderHook(() => useDocumentIngestion());
    const invalidFile = new File(['script'], 'virus.exe', { type: 'application/x-msdownload' });

    act(() => {
      result.current.selectFile(invalidFile);
    });

    expect(result.current.selectedFile).toBeNull();
    expect(result.current.confirmPending).toBe(false);
    expect(result.current.failure).not.toBeNull();
    expect(result.current.failure?.etapa).toBe('VALIDACION_ARCHIVO');
    expect(result.current.failure?.detalle).toContain('Formato no admitido');
  });

  it('transitions from idle to confirmPending when a valid file is selected', () => {
    const { result } = renderHook(() => useDocumentIngestion());
    const validFile = new File(['content'], 'receta.pdf', { type: 'application/pdf' });

    act(() => {
      result.current.selectFile(validFile);
    });

    expect(result.current.selectedFile).toBe(validFile);
    expect(result.current.confirmPending).toBe(true);
    expect(result.current.failure).toBeNull();
  });

  it('cancels confirmation returning to idle', () => {
    const { result } = renderHook(() => useDocumentIngestion());
    const validFile = new File(['content'], 'receta.pdf', { type: 'application/pdf' });

    act(() => {
      result.current.selectFile(validFile);
    });
    expect(result.current.confirmPending).toBe(true);

    act(() => {
      result.current.cancelConfirmation();
    });

    expect(result.current.selectedFile).toBeNull();
    expect(result.current.confirmPending).toBe(false);
  });

  it('transitions through confirming -> uploading/processing -> success on submit', async () => {
    const mockIngestResponse: N8nIngestResponse = {
      status: 'PROCESADO',
      documento_id: 'DOC-55443322',
      clasificacion: {
        tipo_documento: 'INTERCONSULTA',
        nivel_prioridad: 'Urgente',
        score_confianza_clasificacion: 0.95,
      },
    };

    const ingestSpy = vi
      .spyOn(ingestionService, 'ingestDocument')
      .mockResolvedValueOnce(mockIngestResponse);

    const { result } = renderHook(() => useDocumentIngestion());
    const validFile = new File(['content'], 'interconsulta.pdf', { type: 'application/pdf' });

    act(() => {
      result.current.selectFile(validFile);
    });

    let submitPromise: Promise<void>;
    act(() => {
      submitPromise = result.current.submit();
    });

    expect(result.current.confirmPending).toBe(false);
    expect(result.current.isProcessing).toBe(true);

    await act(async () => {
      await submitPromise;
    });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.result).toEqual(mockIngestResponse);
    expect(result.current.failure).toBeNull();
    expect(ingestSpy).toHaveBeenCalledWith(validFile);
  });

  it('transitions to failure when ingestion service throws', async () => {
    vi.spyOn(ingestionService, 'ingestDocument').mockRejectedValueOnce(
      new IngestionError('EXTRACCION', 'Error de lectura OCR en Gemini.')
    );

    const { result } = renderHook(() => useDocumentIngestion());
    const validFile = new File(['bad'], 'ilegible.pdf', { type: 'application/pdf' });

    act(() => {
      result.current.selectFile(validFile);
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.failure).toEqual({
      etapa: 'EXTRACCION',
      detalle: 'Error de lectura OCR en Gemini.',
    });
  });

  it('resets hook state completely', () => {
    const { result } = renderHook(() => useDocumentIngestion());
    const validFile = new File(['content'], 'receta.pdf', { type: 'application/pdf' });

    act(() => {
      result.current.selectFile(validFile);
    });
    expect(result.current.selectedFile).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.selectedFile).toBeNull();
    expect(result.current.confirmPending).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.failure).toBeNull();
  });
});
