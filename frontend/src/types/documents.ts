export type DocumentCategoryFilter =
  | 'ALL'
  | 'RECETAS'
  | 'IMAGENES'
  | 'LABORATORIO'
  | 'PROCEDIMIENTOS'
  | 'EPICRISIS'
  | 'CERTIFICADOS';

export type DocumentDestinationFilter =
  | 'ALL'
  | 'FARMACIA'
  | 'URGENCIAS'
  | 'AUTORIZACIONES'
  | 'FICHA_CLINICA';

export const CATEGORY_MAP: Record<Exclude<DocumentCategoryFilter, 'ALL'>, string> = {
  RECETAS: 'Receta Médica',
  IMAGENES: 'Informe de Estudio por Imágenes',
  LABORATORIO: 'Laboratorio',
  PROCEDIMIENTOS: 'Orden de Solicitud de Procedimiento',
  EPICRISIS: 'Epicrisis / Informe de Alta',
  CERTIFICADOS: 'Certificado Médico',
};

export const DESTINATION_MAP: Record<
  Exclude<DocumentDestinationFilter, 'ALL'>,
  string
> = {
  FARMACIA: 'Farmacia_Hospitalaria',
  URGENCIAS: 'Cola_Emergencia_Medica',
  AUTORIZACIONES: 'Auditoria_Autorizaciones',
  FICHA_CLINICA: 'Historia_Clinica_Electronica',
};
