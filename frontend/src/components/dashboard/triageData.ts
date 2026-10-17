import type { DocumentListItemResponse } from '../../types/medical';

export const triageCases: DocumentListItemResponse[] = [
  {
    documento_id: 'DOC-11837994',
    nombre_paciente: 'Roberto Carlos Plaza Valenzuela',
    identificacion_paciente: '11837994-2',
    tipo_identificacion: 'RUT',
    tipo_documento: 'INFORME_URGENCIA',
    diagnostico_principal: 'Accidente cerebrovascular (ACV) agudo en evolución',
    nivel_prioridad: 'Urgente',
    destino_enrutamiento: 'Cola_Emergencia_Medica',
    score_confianza: 0.98,
    estado: 'PROCESADO',
    oci_json_path: 'clinical-documents/DOC-11837994.json',
    created_at: '2026-10-17T00:00:00.000Z',
  },
  {
    documento_id: 'DOC-88392100',
    nombre_paciente: 'Carmen Gloria Quintana',
    identificacion_paciente: '9283711-K',
    tipo_identificacion: 'RUT',
    tipo_documento: 'INTERCONSULTA',
    diagnostico_principal: 'Sospecha de neoplasia gástrica',
    nivel_prioridad: 'Prioritario',
    destino_enrutamiento: 'Cola_Oncologia',
    score_confianza: 0.92,
    estado: 'PENDIENTE_AUDITORIA',
    oci_json_path: 'clinical-documents/DOC-88392100.json',
    created_at: '2026-10-17T00:00:00.000Z',
  },
  {
    documento_id: 'DOC-74125896',
    nombre_paciente: 'Alejandro Silva Montero',
    identificacion_paciente: '15482963-4',
    tipo_identificacion: 'RUT',
    tipo_documento: 'RECETA',
    diagnostico_principal: 'Hipertensión arterial controlada',
    nivel_prioridad: 'Rutina',
    destino_enrutamiento: 'Farmacia_Hospitalaria',
    score_confianza: 0.95,
    estado: 'AUDITADO',
    oci_json_path: 'clinical-documents/DOC-74125896.json',
    created_at: '2026-10-17T00:00:00.000Z',
  },
];

export const mockTriageCases = triageCases;
export default triageCases;
