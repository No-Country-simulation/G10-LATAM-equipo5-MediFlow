import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateFile,
  ingestDocument,
  MAX_FILE_SIZE_BYTES,
  MAX_TEXT_FILE_SIZE_BYTES,
} from './ingestionService';
import { IngestionError } from '../types/ingestion';

describe('ingestionService validation and n8n transport', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('File validation (validateFile)', () => {
    it('accepts valid PDF and image files under 10 MB', () => {
      const validPdf = new File(['%PDF-1.4 test content'], 'epicrisis.pdf', { type: 'application/pdf' });
      const validJpg = new File(['image-content'], 'receta.jpg', { type: 'image/jpeg' });
      const validPng = new File(['png-content'], 'radiografia.png', { type: 'image/png' });

      expect(validateFile(validPdf)).toBeNull();
      expect(validateFile(validJpg)).toBeNull();
      expect(validateFile(validPng)).toBeNull();
    });

    it('accepts TXT and JSON files up to 1 MB', () => {
      const txt = new File(['Epicrisis: paciente estable'], 'epicrisis.txt', { type: 'text/plain' });
      const json = new File(['{"paciente":"Ana"}'], 'export_his.JSON', { type: '' });

      expect(validateFile(txt)).toBeNull();
      expect(validateFile(json)).toBeNull();
    });

    it('rejects TXT and JSON files over 1 MB', () => {
      const largeText = new File([new Uint8Array(MAX_TEXT_FILE_SIZE_BYTES + 1)], 'nota.txt', { type: 'text/plain' });

      expect(validateFile(largeText)).toBe('Los archivos TXT y JSON no pueden superar 1 MB.');
    });

    it('rejects forbidden file extensions like .exe, .sh, .docx', () => {
      const exeFile = new File(['binary'], 'malware.exe', { type: 'application/octet-stream' });
      const shFile = new File(['#!/bin/bash'], 'script.sh', { type: 'text/x-sh' });
      const docxFile = new File(['doc'], 'historia.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      expect(validateFile(exeFile)).toContain('Formato no admitido');
      expect(validateFile(shFile)).toContain('Formato no admitido');
      expect(validateFile(docxFile)).toContain('Formato no admitido');
    });

    it('rejects files exceeding 10 MB limit', () => {
      const largeContent = new Uint8Array(MAX_FILE_SIZE_BYTES + 1024);
      const largeFile = new File([largeContent], 'scanner_pesado.pdf', { type: 'application/pdf' });

      expect(validateFile(largeFile)).toBe('El archivo supera el límite de 10 MB.');
    });
  });

  describe('Document upload to n8n (ingestDocument)', () => {
    it('constructs FormData with binary, request_id, and Authorization header', async () => {
      sessionStorage.setItem('mediflow_token', 'valid-mock-token');

      let capturedFormData: FormData | null = null;
      let capturedHeaders: Headers | null = null;

      globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
        capturedFormData = init.body as FormData;
        capturedHeaders = new Headers(init.headers);
        return Promise.resolve(
          new Response(
            JSON.stringify({
              status: 'PROCESADO',
              documento_id: 'DOC-99887766',
              clasificacion: { tipo_documento: 'RECETA' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      });

      const file = new File(['pdf-data'], 'orden_medica.pdf', { type: 'application/pdf' });
      const result = await ingestDocument(file);

      expect(result.documento_id).toBe('DOC-99887766');
      expect(result.status).toBe('PROCESADO');

      expect(capturedFormData).not.toBeNull();
      expect(capturedFormData!.get('data')).toBeTruthy();
      expect(capturedFormData!.get('request_id')).toBeTruthy();
      expect(capturedHeaders!.get('Authorization')).toBe('Bearer valid-mock-token');
    });

    it('handles structured n8n error and throws typed IngestionError', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 'error',
            etapa: 'EXTRACCION_GEMINI',
            detalle: 'El modelo no pudo extraer texto legible del documento escaneado.',
            request_id: 'REQ-FAIL-1',
          }),
          { status: 422, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const file = new File(['blurry'], 'borroso.pdf', { type: 'application/pdf' });

      try {
        await ingestDocument(file);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(IngestionError);
        const ingError = err as IngestionError;
        expect(ingError.etapa).toBe('EXTRACCION_GEMINI');
        expect(ingError.message).toContain('El modelo no pudo extraer texto');
      }
    });

    it('handles network failure when n8n is unreachable', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

      const file = new File(['data'], 'test.pdf', { type: 'application/pdf' });

      await expect(ingestDocument(file)).rejects.toThrow(IngestionError);
    });
  });
});
