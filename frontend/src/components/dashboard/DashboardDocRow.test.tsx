import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardDocRow from './DashboardDocRow';
import type { DocumentListItemResponse } from '../../types/medical';

vi.mock('../../services/catalogService', () => ({
  catalogService: {
    getLabels: vi.fn().mockResolvedValue({
      colas: [],
      tipos_documento: [{ codigo: 'ATENCION_URGENCIA', nombre: 'Dato de Atención de Urgencia', is_active: true }],
    }),
  },
}));

vi.mock('../../context/documentDetailContext', () => ({
  useDocumentDetailModal: () => ({ abrirDocumento: vi.fn() }),
}));

const buildDoc = (tipo_documento: string) =>
  ({
    documento_id: 'DOC-URG-1',
    tipo_documento,
    nombre_paciente: 'Paciente de prueba',
    nivel_prioridad: 'Urgente',
    estado: 'PROCESADO',
    requiere_auditoria: false,
    created_at: '2026-10-17T21:00:00Z',
  }) as DocumentListItemResponse;

describe('DashboardDocRow (Requiere atención)', () => {
  it('shows the document type name from the catalog API instead of its code', async () => {
    render(<ul><DashboardDocRow doc={buildDoc('ATENCION_URGENCIA')} /></ul>);

    expect(await screen.findByText('Dato de Atención de Urgencia')).toBeInTheDocument();
    expect(screen.queryByText('ATENCION_URGENCIA')).not.toBeInTheDocument();
  });
});
