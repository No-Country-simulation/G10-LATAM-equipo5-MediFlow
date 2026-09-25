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
  {
    documento_id: 'DOC-CLIN-2026-8945',
    status: 'procesado',
    fecha_ingreso: '2026-09-23 17:50:18',
    clasificacion: {
      tipo_documento: 'Epicrisis / Informe de Alta',
      especialidad: 'Medicina Interna',
      nivel_prioridad: 'Media',
      score_confianza_clasificacion: 0.95,
      score_confianza_extraccion: 0.93,
    },
    datos_extraidos: {
      paciente: {
        nome: 'Camila Valdés',
        edad: 41,
        rut: '15.420.311-8',
      },
      medico_solicitante: {
        nombre: 'Dr. Rodrigo Lagos',
        matricula: 'MED-19402',
      },
      estudio_realizado: 'Resumen de hospitalización y plan de egreso',
      diagnostico_principal: 'Neumonía Adquirida en la Comunidad - Criterio de Alta',
      cie10_sugerido: 'J18.9',
    },
    decision_enrutamiento: {
      destino_principal: 'Historia_Clinica_Electronica',
      requiere_auditoria_humana: false,
      justificacion_enrutamiento:
        'Epicrisis médica validada para archivado en ficha clínica electrónica del paciente.',
    },
    almacenamiento_oci: {
      bucket: 'mediflow-clinical-docs',
      ruta_objeto: 'procesados/rutina/DOC-CLIN-2026-8945.pdf',
      status_backup: 'exito',
    },
  },
  {
    documento_id: 'DOC-CLIN-2026-8946',
    status: 'procesado',
    fecha_ingreso: '2026-09-23 17:35:40',
    clasificacion: {
      tipo_documento: 'Receta Médica',
      especialidad: 'Cardiología Ambulatoria',
      nivel_prioridad: 'Baja',
      score_confianza_clasificacion: 0.97,
      score_confianza_extraccion: 0.95,
    },
    datos_extraidos: {
      paciente: {
        nome: 'Elena Contreras',
        edad: 67,
        rut: '8.123.456-7',
      },
      medico_solicitante: {
        nombre: 'Dra. Patricia Muñoz',
        matricula: 'MED-28491',
      },
      estudio_realizado: 'Prescripción de mantenimiento cardiovascular',
      diagnostico_principal: 'Hipertensión Arterial Esencial Grado II',
      cie10_sugerido: 'I10',
      medicamentos: [
        { nombre: 'Losartán Potásico', dosis: '50mg c/12h' },
        { nombre: 'Amlodipino', dosis: '5mg cada mañana' },
      ],
    },
    decision_enrutamiento: {
      destino_principal: 'Farmacia_Hospitalaria',
      requiere_auditoria_humana: false,
      justificacion_enrutamiento:
        'Receta ambulatoria completa sin interacciones. Enrutada a dispensación en farmacia hospitalaria.',
    },
    almacenamiento_oci: {
      bucket: 'mediflow-clinical-docs',
      ruta_objeto: 'procesados/rutina/DOC-CLIN-2026-8946.pdf',
      status_backup: 'exito',
    },
  },
  {
    documento_id: 'DOC-CLIN-2026-8947',
    status: 'procesado',
    fecha_ingreso: '2026-09-23 17:15:02',
    clasificacion: {
      tipo_documento: 'Laboratorio',
      especialidad: 'Laboratorio Clínico / Urgencias',
      nivel_prioridad: 'Urgente',
      score_confianza_clasificacion: 0.98,
      score_confianza_extraccion: 0.96,
    },
    datos_extraidos: {
      paciente: {
        nome: 'Matías Silva',
        edad: 49,
        rut: '13.892.451-3',
      },
      medico_solicitante: {
        nombre: 'Dr. Álvaro Carrasco',
        matricula: 'MED-41203',
      },
      estudio_realizado: 'Panel de Gases Arteriales y Hemograma Completo',
      diagnostico_principal: 'Acidosis Metabólica Severa con Hiperlactatemia',
      cie10_sugerido: 'E87.2',
    },
    decision_enrutamiento: {
      destino_principal: 'Cola_Emergencia_Medica',
      requiere_auditoria_humana: false,
      justificacion_enrutamiento:
        'Valores críticos de laboratorio con pH 7.18 y lactato 4.8 mmol/L. Derivación inmediata a Shock Room.',
      notificacion_generada: {
        canal: 'Alerta_Guardia_Laboratorio',
        mensaje: 'VALOR CRÍTICO: Paciente Matías Silva con acidosis metabólica severa.',
      },
    },
    almacenamiento_oci: {
      bucket: 'mediflow-clinical-docs',
      ruta_objeto: 'procesados/urgentes/DOC-CLIN-2026-8947.pdf',
      status_backup: 'exito',
    },
  },
  {
    documento_id: 'DOC-CLIN-2026-8948',
    status: 'procesado',
    fecha_ingreso: '2026-09-23 16:50:11',
    clasificacion: {
      tipo_documento: 'Certificado Médico',
      especialidad: 'Traumatología y Ortopedia',
      nivel_prioridad: 'Baja',
      score_confianza_clasificacion: 0.94,
      score_confianza_extraccion: 0.92,
    },
    datos_extraidos: {
      paciente: {
        nome: 'Lorena Paredes',
        edad: 35,
        rut: '17.234.901-5',
      },
      medico_solicitante: {
        nombre: 'Dr. Sebastián Ramos',
        matricula: 'MED-33109',
      },
      estudio_realizado: 'Certificado médico de reposo laboral transitorio',
      diagnostico_principal: 'Esguince de Tobillo Grado II',
      cie10_sugerido: 'S93.4',
    },
    decision_enrutamiento: {
      destino_principal: 'Auditoria_Autorizaciones',
      requiere_auditoria_humana: false,
      justificacion_enrutamiento:
        'Certificado de reposo laboral temporal ambulatorio derivado a auditoría de autorizaciones y licencias.',
    },
    almacenamiento_oci: {
      bucket: 'mediflow-clinical-docs',
      ruta_objeto: 'procesados/rutina/DOC-CLIN-2026-8948.pdf',
      status_backup: 'exito',
    },
  },
];
