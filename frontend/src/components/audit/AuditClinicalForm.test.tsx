import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuditClinicalForm from './AuditClinicalForm';
import type { DocumentForms } from '../../types/forms';
import type { QueueActiveForLLM } from '../../types/catalog';
import type { ClasificacionForm } from '../../hooks/useClinicalForm';

vi.mock('../../context/documentDetailContext', () => ({
  useDocumentDetailModal: () => ({
    abrirDocumento: vi.fn(),
  }),
}));

describe('AuditClinicalForm clinical corrections and validations', () => {
  const mockQueues: QueueActiveForLLM[] = [
    { codigo: 'Cola_Medicina_Interna', nombre: 'Medicina Interna', descripcion_semantica: 'Medicina Interna' },
    { codigo: 'Cola_Urgencias', nombre: 'Urgencias', descripcion_semantica: 'Urgencias' },
  ];

  const mockForms: DocumentForms = {
    datos_generales: {
      type: 'object',
      properties: {
        paciente: {
          type: 'object',
          properties: {
            nombre: { type: 'string', title: 'Nombre del Paciente' },
          },
        },
      },
    },
    comunes: {
      medicamentos: {
        type: 'array',
        title: 'Medicamentos Habituales',
        items: { type: 'string' },
      },
    },
    tipos: [
      {
        codigo: 'EPICRISIS',
        nombre: 'Epicrisis Hospitalaria',
        descripcion: 'Epicrisis hospitalaria',
        bloque: 'epicrisis',
        esquema: {
          type: 'object',
          properties: {
            resumen_clinico: { type: 'string', title: 'Resumen Clínico' },
          },
        },
      },
    ],
  };

  const initialClasificacion: ClasificacionForm = {
    tipo_documento: 'EPICRISIS',
    destino_enrutamiento: 'Cola_Medicina_Interna',
    nivel_prioridad: 'Prioritario',
    especialidad: 'Medicina Interna',
  };

  it('renders classification fields with current values', () => {
    render(
      <AuditClinicalForm
        forms={mockForms}
        formsError={null}
        queues={mockQueues}
        error={null}
        clasificacion={initialClasificacion}
        datosGenerales={{}}
        detalle={{}}
        auditNotes="Revisión inicial del caso"
        onClasificacionChange={vi.fn()}
        onDatosGeneralesChange={vi.fn()}
        onDetalleChange={vi.fn()}
        onAuditNotesChange={vi.fn()}
        handleResolve={vi.fn()}
      />
    );

    const tipoSelect = screen.getByLabelText('Tipo de documento') as HTMLSelectElement;
    expect(tipoSelect.value).toBe('EPICRISIS');

    const destinoSelect = screen.getByLabelText('Destino') as HTMLSelectElement;
    expect(destinoSelect.value).toBe('Cola_Medicina_Interna');

    const prioridadSelect = screen.getByLabelText('Prioridad clínica') as HTMLSelectElement;
    expect(prioridadSelect.value).toBe('Prioritario');

    const especialidadInput = screen.getByLabelText('Especialidad') as HTMLInputElement;
    expect(especialidadInput.value).toBe('Medicina Interna');
  });

  it('fires onClasificacionChange when changing priority or destination', () => {
    const handleClasificacionChange = vi.fn();

    render(
      <AuditClinicalForm
        forms={mockForms}
        formsError={null}
        queues={mockQueues}
        error={null}
        clasificacion={initialClasificacion}
        datosGenerales={{}}
        detalle={{}}
        auditNotes=""
        onClasificacionChange={handleClasificacionChange}
        onDatosGeneralesChange={vi.fn()}
        onDetalleChange={vi.fn()}
        onAuditNotesChange={vi.fn()}
        handleResolve={vi.fn()}
      />
    );

    const prioridadSelect = screen.getByLabelText('Prioridad clínica');
    fireEvent.change(prioridadSelect, { target: { name: 'nivel_prioridad', value: 'Urgente' } });
    expect(handleClasificacionChange).toHaveBeenCalled();

    const destinoSelect = screen.getByLabelText('Destino');
    fireEvent.change(destinoSelect, { target: { name: 'destino_enrutamiento', value: 'Cola_Urgencias' } });
    expect(handleClasificacionChange).toHaveBeenCalled();
  });

  it('renders audit notes textarea as required and fires onAuditNotesChange', async () => {
    const handleAuditNotesChange = vi.fn();
    const user = userEvent.setup();

    render(
      <AuditClinicalForm
        forms={mockForms}
        formsError={null}
        queues={mockQueues}
        error={null}
        clasificacion={initialClasificacion}
        datosGenerales={{}}
        detalle={{}}
        auditNotes=""
        onClasificacionChange={vi.fn()}
        onDatosGeneralesChange={vi.fn()}
        onDetalleChange={vi.fn()}
        onAuditNotesChange={handleAuditNotesChange}
        handleResolve={vi.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText(/Justifique las correcciones/i);
    expect(textarea).toBeRequired();

    await user.type(textarea, 'Corrección de CIE-10 a I50.9');
    expect(handleAuditNotesChange).toHaveBeenCalled();
  });

  it('displays audit reasons (motivos) when present', () => {
    const motivos = [
      'Confianza de clasificación subóptima (0.64 < 0.85)',
      'Inconsistencia entre diagnóstico y especialidad',
    ];

    render(
      <AuditClinicalForm
        forms={mockForms}
        formsError={null}
        queues={mockQueues}
        motivos={motivos}
        error={null}
        clasificacion={initialClasificacion}
        datosGenerales={{}}
        detalle={{}}
        auditNotes=""
        onClasificacionChange={vi.fn()}
        onDatosGeneralesChange={vi.fn()}
        onDetalleChange={vi.fn()}
        onAuditNotesChange={vi.fn()}
        handleResolve={vi.fn()}
      />
    );

    expect(screen.getByText('Motivos de Auditoría:')).toBeInTheDocument();
    expect(screen.getByText(/Confianza de clasificación subóptima/)).toBeInTheDocument();
    expect(screen.getByText(/Inconsistencia entre diagnóstico y especialidad/)).toBeInTheDocument();
  });

  it('displays error alert when error or formsError is provided', () => {
    const { rerender } = render(
      <AuditClinicalForm
        forms={mockForms}
        formsError={null}
        queues={mockQueues}
        error="El RUT del paciente no tiene dígito verificador válido"
        clasificacion={initialClasificacion}
        datosGenerales={{}}
        detalle={{}}
        auditNotes=""
        onClasificacionChange={vi.fn()}
        onDatosGeneralesChange={vi.fn()}
        onDetalleChange={vi.fn()}
        onAuditNotesChange={vi.fn()}
        handleResolve={vi.fn()}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/El RUT del paciente/);

    rerender(
      <AuditClinicalForm
        forms={null}
        formsError="No se pudieron cargar los esquemas dinámicos"
        queues={mockQueues}
        error={null}
        clasificacion={initialClasificacion}
        datosGenerales={{}}
        detalle={{}}
        auditNotes=""
        onClasificacionChange={vi.fn()}
        onDatosGeneralesChange={vi.fn()}
        onDetalleChange={vi.fn()}
        onAuditNotesChange={vi.fn()}
        handleResolve={vi.fn()}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/No se pudieron cargar los esquemas dinámicos/);
  });

  it('executes handleResolve when the form is submitted', () => {
    const handleResolve = vi.fn((e) => e.preventDefault());

    render(
      <AuditClinicalForm
        forms={mockForms}
        formsError={null}
        queues={mockQueues}
        error={null}
        clasificacion={initialClasificacion}
        datosGenerales={{}}
        detalle={{}}
        auditNotes="Se valida diagnóstico y destino"
        onClasificacionChange={vi.fn()}
        onDatosGeneralesChange={vi.fn()}
        onDetalleChange={vi.fn()}
        onAuditNotesChange={vi.fn()}
        handleResolve={handleResolve}
      />
    );

    const form = screen.getByRole('textbox', { name: /justificación/i }).closest('form');
    expect(form).toBeInTheDocument();
    if (form) {
      fireEvent.submit(form);
      expect(handleResolve).toHaveBeenCalledTimes(1);
    }
  });

  it('renders dynamic schema sections for general patient data and document type', () => {
    render(
      <AuditClinicalForm
        forms={mockForms}
        formsError={null}
        queues={mockQueues}
        error={null}
        clasificacion={initialClasificacion}
        datosGenerales={{}}
        detalle={{}}
        auditNotes=""
        onClasificacionChange={vi.fn()}
        onDatosGeneralesChange={vi.fn()}
        onDetalleChange={vi.fn()}
        onAuditNotesChange={vi.fn()}
        handleResolve={vi.fn()}
      />
    );

    expect(screen.getByText('Paciente y documento')).toBeInTheDocument();
    expect(screen.getByText('Campos de Epicrisis Hospitalaria')).toBeInTheDocument();
    expect(screen.getAllByText('Medicamentos Habituales').length).toBeGreaterThanOrEqual(1);
  });
});
