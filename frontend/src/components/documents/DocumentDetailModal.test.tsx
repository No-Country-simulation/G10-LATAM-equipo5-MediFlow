import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DocumentDetailModal from './DocumentDetailModal';
import type { DocumentDetailResponse } from '../../types/medical';
import type { UserRole } from '../../types/auth';

let mockUserRole: UserRole = 'ADMIN';
let mockLoading = false;
let mockError: string | null = null;
let mockDetail: DocumentDetailResponse | null = null;

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u-1', username: 'testuser', role: mockUserRole, is_active: true },
    isAuthenticated: true,
  }),
}));

vi.mock('../../hooks/useDocumentDetail', () => ({
  useDocumentDetail: () => ({
    detail: mockDetail,
    loading: mockLoading,
    error: mockError,
    recargar: vi.fn(),
  }),
}));

vi.mock('../../context/documentDetailContext', () => ({
  useDocumentDetailModal: () => ({
    abrirDocumento: vi.fn(),
    notificarCambio: vi.fn(),
    revision: 0,
  }),
}));

vi.mock('../../hooks/useCatalogs', () => ({
  useCatalogs: () => ({
    queues: [],
    documentTypes: [],
    areas: [],
    loaded: true,
  }),
}));

vi.mock('../../hooks/useDocumentForms', () => ({
  useDocumentForms: () => ({
    forms: {
      datos_generales: { type: 'object', properties: {} },
      comunes: {},
      tipos: [],
    },
    error: null,
  }),
}));

describe('DocumentDetailModal patient safety and RBAC', () => {
  const sampleDetail: DocumentDetailResponse = {
    documento_id: 'DOC-99881122',
    estado: 'PROCESADO',
    identificacion_paciente: '18492019-3',
    tipo_identificacion: 'RUT',
    nombre_paciente: 'María José Figueroa',
    tipo_documento: 'RECETA',
    nivel_prioridad: 'Prioritario',
    score_confianza: 0.94,
    destino_enrutamiento: 'Farmacia_Hospitalaria',
    oci_json_path: 'clinical-documents/DOC-99881122.json',
    created_at: '2026-10-17T01:00:00Z',
    diagnostico_principal: 'Insuficiencia cardíaca congestiva',
    especialidad: 'Cardiología',
    cie10_origen: 'I50.0',
    pais_identificacion: 'CHL',
    edad_paciente: 64,
    fecha_nacimiento: '1962-04-12',
    sexo: 'Femenino',
    medico_identificacion: '12345678-9',
    requiere_auditoria: false,
    justificacion_enrutamiento: 'Prescripción ambulatoria',
    area_origen: { id: 'area-1', codigo: 'CARDIOLOGIA', nombre: 'Cardiología' },
    motivos_auditoria: [],
    audited_at: null,
    audit_notes: null,
    archivos: [
      {
        orden: 1,
        tipo_archivo: 'PDF',
        rol: 'RECETA_PRINCIPAL',
        url: 'https://objectstorage.oci.oraclecloud.com/preview.pdf',
        visualizable: true,
      },
    ],
    preview_expira_en_minutos: 60,
    aviso_archivos: null,
    detalle: {
      tablas: {
        diagnosticos: [],
        profesionales: [],
        medicamentos: [],
        examenes_solicitados: [],
        paneles_laboratorio: [],
        procedimientos: [],
      },
      campos_relevantes: [],
    },
    datos_generales: {},
    detalle_clinico: {},
    historial_correcciones: [],
    duplicados: [],
  };

  beforeEach(() => {
    mockUserRole = 'ADMIN';
    mockLoading = false;
    mockError = null;
    mockDetail = sampleDetail;
  });

  describe('Accidental closing protection while editing', () => {
    it('closes on Escape or backdrop click in read-only mode', async () => {
      const handleClose = vi.fn();
      render(<DocumentDetailModal documentoId="DOC-99881122" onClose={handleClose} />);

      // Press Escape
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);

      // Click backdrop
      const dialog = screen.getByRole('dialog');
      fireEvent.click(dialog);
      expect(handleClose).toHaveBeenCalledTimes(2);
    });

    it('blocks Escape key and backdrop closing while user is editing metadata', async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();
      render(<DocumentDetailModal documentoId="DOC-99881122" onClose={handleClose} />);

      // Enter edit mode
      const editButton = screen.getByRole('button', { name: /corregir/i });
      await user.click(editButton);

      // Try closing with Escape
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).not.toHaveBeenCalled();

      // Try clicking backdrop
      const dialog = screen.getByRole('dialog');
      fireEvent.click(dialog);
      expect(handleClose).not.toHaveBeenCalled();
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    it('shows both Corregir and Eliminar buttons for ADMIN', () => {
      mockUserRole = 'ADMIN';
      render(<DocumentDetailModal documentoId="DOC-99881122" onClose={vi.fn()} />);

      expect(screen.getByRole('button', { name: /corregir/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /eliminar/i })).toBeInTheDocument();
    });

    it('shows Corregir but hides Eliminar for AUDITOR_CLINICO', () => {
      mockUserRole = 'AUDITOR_CLINICO';
      render(<DocumentDetailModal documentoId="DOC-99881122" onClose={vi.fn()} />);

      expect(screen.getByRole('button', { name: /corregir/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument();
    });

    it('hides both Corregir and Eliminar for OPERADOR (read-only)', () => {
      mockUserRole = 'OPERADOR';
      render(<DocumentDetailModal documentoId="DOC-99881122" onClose={vi.fn()} />);

      expect(screen.queryByRole('button', { name: /corregir/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument();
    });
  });

  describe('Loading and Error handling', () => {
    it('renders loading spinner when fetching document', () => {
      mockDetail = null;
      mockLoading = true;

      render(<DocumentDetailModal documentoId="DOC-99881122" onClose={vi.fn()} />);
      expect(screen.getByText('Cargando detalle del documento...')).toBeInTheDocument();
    });

    it('renders alert message when fetch fails', () => {
      mockDetail = null;
      mockError = 'Error al cargar expediente desde OCI';

      render(<DocumentDetailModal documentoId="DOC-99881122" onClose={vi.fn()} />);
      expect(screen.getByRole('alert')).toHaveTextContent('Error al cargar expediente desde OCI');
    });
  });
});
