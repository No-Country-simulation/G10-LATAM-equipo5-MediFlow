export type DocumentCategoryFilter =
  | 'ALL'
  | 'RECETA'
  | 'LABORATORIO'
  | 'IMAGENES'
  | 'SOLICITUD_PROCEDIMIENTO'
  | 'EPICRISIS'
  | 'INTERCONSULTA'
  | 'ANATOMIA_PATOLOGICA'
  | 'PROTOCOLO_OPERATORIO'
  | 'OTRO';

export type DocumentDestinationFilter =
  | 'ALL'
  | 'Cola_Emergencia_Medica'
  | 'Farmacia_Hospitalaria'
  | 'Gestion_Procedimientos'
  | 'Gestion_Interconsultas'
  | 'Cola_Oncologia'
  | 'Ficha_Clinica'
  | 'OTROS';

export const CANONICAL_QUEUES: ReadonlyArray<Exclude<DocumentDestinationFilter, 'ALL' | 'OTROS'>> = [
  'Cola_Emergencia_Medica',
  'Farmacia_Hospitalaria',
  'Gestion_Procedimientos',
  'Gestion_Interconsultas',
  'Cola_Oncologia',
  'Ficha_Clinica',
];

export const DESTINATION_LABELS: Record<Exclude<DocumentDestinationFilter, 'ALL'>, string> = {
  Cola_Emergencia_Medica: 'Urgencias',
  Farmacia_Hospitalaria: 'Farmacia Hospitalaria',
  Gestion_Procedimientos: 'Procedimientos y Quirófano',
  Gestion_Interconsultas: 'Interconsultas y Derivaciones',
  Cola_Oncologia: 'Oncología',
  Ficha_Clinica: 'Ficha Clínica',
  OTROS: 'Otras Derivaciones',
};

export const CATEGORY_LABELS: Record<Exclude<DocumentCategoryFilter, 'ALL'>, string> = {
  RECETA: 'Receta Médica',
  LABORATORIO: 'Informe de Laboratorio',
  IMAGENES: 'Informe de Estudio por Imágenes',
  SOLICITUD_PROCEDIMIENTO: 'Solicitud de Procedimiento',
  EPICRISIS: 'Epicrisis / Informe de Alta',
  INTERCONSULTA: 'Interconsulta / Derivación',
  ANATOMIA_PATOLOGICA: 'Informe de Anatomía Patológica',
  PROTOCOLO_OPERATORIO: 'Protocolo Operatorio',
  OTRO: 'Otro / No clasificable',
};
