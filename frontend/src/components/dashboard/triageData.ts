import type { TriageDocument } from '../../types/triage';

export const MOCK_TRIAGE_DOCUMENTS: TriageDocument[] = [
  {
    documento_id: 'DOC-CLIN-2026-8942',
    status: 'procesado',
    fecha_ingreso: '2026-09-23 18:42:10',
    clasificacion: {
      tipo_documento: 'Informe de Estudio por Imágenes',
      especialidad: 'Radiología / Urgencias',
      nivel_prioridad: 'Urgente',
      score_confianza_clasificacion: 0.98,
      score_confianza_extraccion: 0.96,
    },
    datos_extraidos: {
      paciente: {
        nome: 'Carlos Morales',
        edad: 58,
        rut: '12.345.678-9',
      },
      medico_solicitante: {
        nombre: 'Dra. Marcela Gómez',
        matricula: 'MED-48921',
      },
      estudio_realizado: 'AngioTAC de Tórax con contraste',
      diagnostico_principal: 'Tromboembolismo Pulmonar Agudo (TEP) masivo bilateral',
      cie10_sugerido: 'I26.0',
    },
    decision_enrutamiento: {
      destino_principal: 'Cola_Emergencia_Medica',
      requiere_auditoria_humana: false,
      justificacion_enrutamiento:
        'Hallazgo crítico de riesgo vital inminente. Protocolo TEP agudo con derivación directa a Shock Room.',
      notificacion_generada: {
        canal: 'WhatsApp_Guardia_Emergencia',
        mensaje: 'ALERTA TEP AGUDO: Paciente Carlos Morales derivado a Emergencias Médicas.',
      },
    },
    almacenamiento_oci: {
      bucket: 'mediflow-clinical-docs',
      ruta_objeto: 'procesados/urgentes/DOC-CLIN-2026-8942.pdf',
      status_backup: 'exito',
    },
  },
  {
    documento_id: 'DOC-CLIN-2026-8943',
    status: 'en_revision',
    fecha_ingreso: '2026-09-23 18:35:22',
    clasificacion: {
      tipo_documento: 'Receta Médica',
      especialidad: 'Medicina General',
      nivel_prioridad: 'Media',
      score_confianza_clasificacion: 0.65,
      score_confianza_extraccion: 0.58,
    },
    datos_extraidos: {
      paciente: {
        nome: 'Valentina Rojas',
        edad: 34,
        rut: '18.912.453-K',
      },
      medico_solicitante: {
        nombre: 'Dr. Andrés Valenzuela',
        matricula: 'MED-31054',
      },
      estudio_realizado: 'Prescripción farmacológica broncodilatadora',
      diagnostico_principal: 'Crisis Asmática Severa',
      cie10_sugerido: 'J45.9',
      medicamentos: [
        { nombre: 'Salbutamol Inhalador', dosis: '2 puff c/4h [ilegible]' },
        { nombre: 'Prednisona', dosis: '[trazo manuscrito difuso]' },
      ],
    },
    decision_enrutamiento: {
      destino_principal: 'Cola_Revision_Humana',
      requiere_auditoria_humana: true,
      justificacion_enrutamiento:
        'Score de extracción insuficiente (0.65 < 0.85). Posología manuscrita difusa requiere validación humana.',
    },
    almacenamiento_oci: {
      bucket: 'mediflow-clinical-docs',
      ruta_objeto: 'procesados/auditoria/DOC-CLIN-2026-8943.pdf',
      status_backup: 'exito',
    },
  },
  {
    documento_id: 'DOC-CLIN-2026-8944',
    status: 'procesado',
    fecha_ingreso: '2026-09-23 18:20:05',
    clasificacion: {
      tipo_documento: 'Orden de Solicitud de Procedimiento',
      especialidad: 'Gastroenterología Quirúrgica',
      nivel_prioridad: 'Baja',
      score_confianza_clasificacion: 0.94,
      score_confianza_extraccion: 0.92,
    },
    datos_extraidos: {
      paciente: {
        nome: 'Jorge Navarrete',
        edad: 62,
        rut: '9.876.543-2',
      },
      medico_solicitante: {
        nombre: 'Dr. Fernando Soto',
        matricula: 'MED-22189',
      },
      estudio_realizado: 'Tomografía Computada Abdomen y Pelvis con contraste',
      diagnostico_principal: 'Control postoperatorio colecistectomía programada',
      cie10_sugerido: 'K80.2',
    },
    decision_enrutamiento: {
      destino_principal: 'Auditoria_Autorizaciones',
      requiere_auditoria_humana: false,
      justificacion_enrutamiento:
        'Solicitud ambulatoria estándar completa. Enrutada a auditoría de autorizaciones y convenios.',
    },
    almacenamiento_oci: {
      bucket: 'mediflow-clinical-docs',
      ruta_objeto: 'procesados/rutina/DOC-CLIN-2026-8944.pdf',
      status_backup: 'exito',
    },
  },
];
