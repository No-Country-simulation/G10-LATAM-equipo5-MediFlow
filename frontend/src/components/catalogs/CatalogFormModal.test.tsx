import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CatalogFormModal } from './CatalogFormModal';
import { CATALOGS } from './catalogConfig';
import type { DocumentTypeRecord, QueueRecord } from '../../types/catalog';

describe('CatalogFormModal integration', () => {
  const docTypeDefinition = CATALOGS.find((c) => c.key === 'documentTypes')!;

  const existingRecord: DocumentTypeRecord = {
    id: 'dt-1',
    codigo: 'LICENCIA_MEDICA',
    nombre: 'Licencia Médica',
    descripcion: 'Justificativo laboral de reposo',
    campos_extraccion: {
      type: 'object',
      properties: { dias_reposo: { type: 'integer' } },
    },
    is_active: true,
    es_sistema: false,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };

  it('renders creation form with mandatory clinical fields', () => {
    render(
      <CatalogFormModal
        definition={docTypeDefinition}
        onClose={vi.fn()}
        onCreate={vi.fn().mockResolvedValue(true)}
        onUpdate={vi.fn().mockResolvedValue(true)}
      />
    );

    expect(screen.getByRole('heading', { name: 'Nuevo tipo de documento' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Código' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nombre' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Descripción para la IA' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /opciones avanzadas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear' })).toBeInTheDocument();
  });

  it('disables the Código field in edit mode to preserve immutability', () => {
    render(
      <CatalogFormModal
        definition={docTypeDefinition}
        record={existingRecord}
        onClose={vi.fn()}
        onCreate={vi.fn().mockResolvedValue(true)}
        onUpdate={vi.fn().mockResolvedValue(true)}
      />
    );

    expect(screen.getByRole('heading', { name: 'Editar tipo de documento' })).toBeInTheDocument();

    const codigoInput = screen.getByRole('textbox', { name: 'Código' });
    expect(codigoInput).toBeDisabled();
    expect(codigoInput).toHaveValue('LICENCIA_MEDICA');

    // Other fields remain editable
    const nombreInput = screen.getByRole('textbox', { name: 'Nombre' });
    expect(nombreInput).not.toBeDisabled();
    expect(nombreInput).toHaveValue('Licencia Médica');
  });

  it('blocks form submission when JSON Schema in accordion is invalid', async () => {
    const user = userEvent.setup();
    const handleCreate = vi.fn().mockResolvedValue(true);

    render(
      <CatalogFormModal
        definition={docTypeDefinition}
        onClose={vi.fn()}
        onCreate={handleCreate}
        onUpdate={vi.fn().mockResolvedValue(true)}
      />
    );

    // Open accordion
    const accordionBtn = screen.getByRole('button', { name: /opciones avanzadas/i });
    await user.click(accordionBtn);

    const jsonTextarea = screen.getByRole('textbox', {
      name: 'Campos adicionales (JSON Schema, opcional)',
    });

    // Enter corrupted JSON
    fireEvent.change(jsonTextarea, { target: { value: '{"type": "object",' } });

    const submitBtn = screen.getByRole('button', { name: 'Crear' });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByText('JSON inválido')).toBeInTheDocument();

    // Attempting submit should not call onCreate
    await user.click(submitBtn);
    expect(handleCreate).not.toHaveBeenCalled();
  });

  it('submits normalized payload with null campos_extraccion when schema is untouched', async () => {
    const user = userEvent.setup();
    const handleCreate = vi.fn().mockResolvedValue(true);
    const handleClose = vi.fn();

    render(
      <CatalogFormModal
        definition={docTypeDefinition}
        onClose={handleClose}
        onCreate={handleCreate}
        onUpdate={vi.fn().mockResolvedValue(true)}
      />
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Código' }), { target: { value: 'DEFUNCION' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre' }), { target: { value: 'Certificado de Defunción' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Descripción para la IA' }), {
      target: { value: 'Documento legal de fallecimiento' },
    });

    const submitBtn = screen.getByRole('button', { name: 'Crear' });
    expect(submitBtn).not.toBeDisabled();
    await user.click(submitBtn);

    await waitFor(() => {
      expect(handleCreate).toHaveBeenCalledTimes(1);
    });

    expect(handleCreate).toHaveBeenCalledWith({
      codigo: 'DEFUNCION',
      nombre: 'Certificado de Defunción',
      descripcion: 'Documento legal de fallecimiento',
      campos_extraccion: null,
    });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onUpdate without codigo in edit mode', async () => {
    const user = userEvent.setup();
    const handleUpdate = vi.fn().mockResolvedValue(true);
    const handleClose = vi.fn();

    render(
      <CatalogFormModal
        definition={docTypeDefinition}
        record={existingRecord}
        onClose={handleClose}
        onCreate={vi.fn().mockResolvedValue(true)}
        onUpdate={handleUpdate}
      />
    );

    const nombreInput = screen.getByRole('textbox', { name: 'Nombre' });
    fireEvent.change(nombreInput, { target: { value: 'Licencia Médica Actualizada' } });

    const submitBtn = screen.getByRole('button', { name: 'Guardar Cambios' });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(handleUpdate).toHaveBeenCalledTimes(1);
    });

    // Verifies codigo is omitted in payload on update
    expect(handleUpdate).toHaveBeenCalledWith(
      'dt-1',
      expect.objectContaining({
        nombre: 'Licencia Médica Actualizada',
        descripcion: 'Justificativo laboral de reposo',
      })
    );
    expect(handleUpdate.mock.calls[0][1]).not.toHaveProperty('codigo');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});

describe('CatalogFormModal system queues', () => {
  const queueDefinition = CATALOGS.find((c) => c.key === 'queues')!;

  const buildQueue = (overrides: Partial<QueueRecord> = {}): QueueRecord => ({
    id: 'q-1',
    codigo: 'Gestion_Interconsultas',
    nombre: 'Interconsultas',
    descripcion_semantica: 'Interconsultas a otra especialidad',
    notificar_inmediato: false,
    es_asistencial: true,
    is_active: true,
    es_sistema: false,
    created_at: '2026-01-01',
    ...overrides,
  });

  const renderQueueForm = (record: QueueRecord, onUpdate = vi.fn().mockResolvedValue(true)) =>
    render(
      <CatalogFormModal
        definition={queueDefinition}
        record={record}
        onClose={vi.fn()}
        onCreate={vi.fn().mockResolvedValue(true)}
        onUpdate={onUpdate}
      />
    );

  it('lets a regular queue be shown in the Triage console', () => {
    renderQueueForm(buildQueue());
    expect(screen.getByRole('checkbox', { name: /aparece en la consola de triaje/i })).toBeChecked();
  });

  it('does not offer "Notificar de inmediato" nor send it (no alert is delivered anywhere)', async () => {
    const handleUpdate = vi.fn().mockResolvedValue(true);
    renderQueueForm(buildQueue({ notificar_inmediato: true }), handleUpdate);

    expect(screen.queryByRole('checkbox', { name: /notificar de inmediato/i })).not.toBeInTheDocument();
    fireEvent.submit(screen.getByRole('button', { name: /guardar cambios/i }));

    // Sin el campo en el payload, el backend conserva el valor que la cola ya tenía.
    await waitFor(() => expect(handleUpdate).toHaveBeenCalled());
    expect(handleUpdate.mock.calls[0][1]).not.toHaveProperty('notificar_inmediato');
  });

  it('hides the Triage option for a system queue (Ficha Clínica) and does not send it', async () => {
    const handleUpdate = vi.fn().mockResolvedValue(true);
    renderQueueForm(buildQueue({ codigo: 'Ficha_Clinica', es_sistema: true, es_asistencial: false }), handleUpdate);

    expect(screen.queryByRole('checkbox', { name: /aparece en la consola de triaje/i })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /descripción semántica/i })).toBeInTheDocument();

    fireEvent.submit(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(handleUpdate).toHaveBeenCalled());
    expect(handleUpdate.mock.calls[0][1]).not.toHaveProperty('es_asistencial');
  });
});
