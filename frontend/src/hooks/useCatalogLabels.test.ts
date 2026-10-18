import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { invalidateCatalogLabels, useCatalogLabels } from './useCatalogLabels';
import { catalogService } from '../services/catalogService';

vi.mock('../services/catalogService', () => ({
  catalogService: { getLabels: vi.fn() },
}));

const LABELS = {
  colas: [
    { codigo: 'Ficha_Clinica', nombre: 'Ficha Clínica', is_active: true },
    { codigo: 'Cola_Antigua', nombre: 'Cola Antigua', is_active: false },
  ],
  tipos_documento: [
    { codigo: 'ATENCION_URGENCIA', nombre: 'Dato de Atención de Urgencia', is_active: true },
    { codigo: 'TIPO_RETIRADO', nombre: 'Tipo Retirado', is_active: false },
  ],
};

const renderLabels = async () => {
  const { result } = renderHook(() => useCatalogLabels());
  await waitFor(() => expect(result.current.queueName('Ficha_Clinica')).toBe('Ficha Clínica'));
  return result.current;
};

describe('useCatalogLabels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateCatalogLabels();
    vi.mocked(catalogService.getLabels).mockResolvedValue(LABELS);
  });

  it('uses the names from the database catalog, including inactive records', async () => {
    const { queueName, documentTypeName } = await renderLabels();

    expect(queueName('Cola_Antigua')).toBe('Cola Antigua');
    expect(documentTypeName('ATENCION_URGENCIA')).toBe('Dato de Atención de Urgencia');
    expect(documentTypeName('TIPO_RETIRADO')).toBe('Tipo Retirado');
  });

  it('shows the code for values missing from the catalog, and null without a value', async () => {
    const { queueName, documentTypeName } = await renderLabels();

    expect(queueName('Cola_Inexistente')).toBe('Cola_Inexistente');
    expect(documentTypeName('TIPO_INEXISTENTE')).toBe('TIPO_INEXISTENTE');
    expect(documentTypeName(null)).toBeNull();
  });

  it('loads the names once for every component that shows them', async () => {
    renderHook(() => useCatalogLabels());
    renderHook(() => useCatalogLabels());
    await renderLabels();

    expect(catalogService.getLabels).toHaveBeenCalledTimes(1);
  });

  it('keeps showing codes when the catalog cannot be loaded', async () => {
    vi.mocked(catalogService.getLabels).mockRejectedValueOnce(new Error('Sin conexión'));
    const { result } = renderHook(() => useCatalogLabels());

    await waitFor(() => expect(catalogService.getLabels).toHaveBeenCalled());
    expect(result.current.documentTypeName('ATENCION_URGENCIA')).toBe('ATENCION_URGENCIA');
  });
});
