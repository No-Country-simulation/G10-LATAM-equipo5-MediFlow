import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DocumentFilters from './DocumentFilters';
import type { DocumentFiltersValue } from '../../types/documents';

vi.mock('../../hooks/useCatalogs', () => ({
  useCatalogs: () => ({
    queues: [
      { id: 'q-1', codigo: 'Cola_Urgencias', nombre: 'Urgencias' },
      { id: 'q-2', codigo: 'Cola_Medicina_Interna', nombre: 'Medicina Interna' },
    ],
  }),
}));

vi.mock('../../hooks/useActiveAreas', () => ({
  useActiveAreas: () => ({
    areas: [
      { id: 'area-1', nombre: 'Box de Urgencia 1', activa: true },
      { id: 'area-2', nombre: 'Pabellón Central', activa: true },
    ],
  }),
}));

describe('DocumentFilters clinical document filtering', () => {
  const defaultFilters: DocumentFiltersValue = {
    destino: 'ALL',
    prioridad: 'ALL',
    estado: 'TODOS',
    identificacion: '',
    areaOrigenId: '',
    datePreset: 'MES_ACTUAL',
    fechaDesde: '',
    fechaHasta: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders date presets and fires onChange when a preset is selected', () => {
    const handleChange = vi.fn();

    render(
      <DocumentFilters
        filters={defaultFilters}
        onChange={handleChange}
        onReset={vi.fn()}
        isDirty={false}
        showAreaFilter={true}
        showDeletedFilter={false}
      />
    );

    const hoyBtn = screen.getByRole('button', { name: /^hoy$/i });
    fireEvent.click(hoyBtn);

    expect(handleChange).toHaveBeenCalledWith({ datePreset: 'HOY' });
  });

  it('renders date range inputs when datePreset is RANGO and fires onChange', () => {
    const handleChange = vi.fn();
    const rangeFilters: DocumentFiltersValue = {
      ...defaultFilters,
      datePreset: 'RANGO',
      fechaDesde: '2026-10-01',
      fechaHasta: '2026-10-15',
    };

    render(
      <DocumentFilters
        filters={rangeFilters}
        onChange={handleChange}
        onReset={vi.fn()}
        isDirty={true}
        showAreaFilter={true}
        showDeletedFilter={false}
      />
    );

    const desdeInput = screen.getByLabelText(/desde/i);
    fireEvent.change(desdeInput, { target: { value: '2026-10-05' } });
    expect(handleChange).toHaveBeenCalledWith({ fechaDesde: '2026-10-05' });

    const hastaInput = screen.getByLabelText(/hasta/i);
    fireEvent.change(hastaInput, { target: { value: '2026-10-16' } });
    expect(handleChange).toHaveBeenCalledWith({ fechaHasta: '2026-10-16' });
  });

  it('filters by patient identification and fires onChange', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <DocumentFilters
        filters={defaultFilters}
        onChange={handleChange}
        onReset={vi.fn()}
        isDirty={false}
        showAreaFilter={false}
        showDeletedFilter={false}
      />
    );

    const searchInput = screen.getByPlaceholderText(/RUT, DNI, cédula/i);
    await user.type(searchInput, '12.345.678-5');

    expect(handleChange).toHaveBeenCalled();
  });

  it('shows and handles "Limpiar filtros" only when isDirty is true', () => {
    const handleReset = vi.fn();

    const { rerender } = render(
      <DocumentFilters
        filters={defaultFilters}
        onChange={vi.fn()}
        onReset={handleReset}
        isDirty={false}
        showAreaFilter={true}
        showDeletedFilter={false}
      />
    );

    expect(screen.queryByRole('button', { name: /limpiar filtros/i })).not.toBeInTheDocument();

    rerender(
      <DocumentFilters
        filters={{ ...defaultFilters, prioridad: 'Urgente' }}
        onChange={vi.fn()}
        onReset={handleReset}
        isDirty={true}
        showAreaFilter={true}
        showDeletedFilter={false}
      />
    );

    const resetBtn = screen.getByRole('button', { name: /limpiar filtros/i });
    expect(resetBtn).toBeInTheDocument();
    fireEvent.click(resetBtn);

    expect(handleReset).toHaveBeenCalledTimes(1);
  });

  it('renders area filter dropdown only when showAreaFilter is true', () => {
    const handleChange = vi.fn();

    const { rerender } = render(
      <DocumentFilters
        filters={defaultFilters}
        onChange={handleChange}
        onReset={vi.fn()}
        isDirty={false}
        showAreaFilter={false}
        showDeletedFilter={false}
      />
    );

    expect(screen.queryByText('Área de origen')).not.toBeInTheDocument();

    rerender(
      <DocumentFilters
        filters={defaultFilters}
        onChange={handleChange}
        onReset={vi.fn()}
        isDirty={false}
        showAreaFilter={true}
        showDeletedFilter={false}
      />
    );

    expect(screen.getByText('Área de origen')).toBeInTheDocument();
    const areaSelect = screen.getByRole('combobox');
    fireEvent.change(areaSelect, { target: { value: 'area-1' } });

    expect(handleChange).toHaveBeenCalledWith({ areaOrigenId: 'area-1' });
  });

  it('renders "Eliminados" option in status filter only when showDeletedFilter is true', () => {
    const { rerender } = render(
      <DocumentFilters
        filters={defaultFilters}
        onChange={vi.fn()}
        onReset={vi.fn()}
        isDirty={false}
        showAreaFilter={false}
        showDeletedFilter={false}
      />
    );

    expect(screen.queryByRole('button', { name: /eliminados/i })).not.toBeInTheDocument();

    rerender(
      <DocumentFilters
        filters={defaultFilters}
        onChange={vi.fn()}
        onReset={vi.fn()}
        isDirty={false}
        showAreaFilter={false}
        showDeletedFilter={true}
      />
    );

    expect(screen.getByRole('button', { name: /eliminados/i })).toBeInTheDocument();
  });
});
