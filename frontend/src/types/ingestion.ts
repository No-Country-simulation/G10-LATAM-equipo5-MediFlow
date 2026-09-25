export interface ClinicalSample {
  name: string;
  category: string;
  format: 'PDF' | 'PNG' | 'JPG';
  size: string;
}

export const CLINICAL_SAMPLES: ClinicalSample[] = [
  {
    name: 'receta_urgencias_salbutamol.pdf',
    category: 'Receta médica',
    format: 'PDF',
    size: '1.2 MB',
  },
  {
    name: 'angiotac_torax_contraste.pdf',
    category: 'Estudio por imágenes',
    format: 'PDF',
    size: '3.4 MB',
  },
  {
    name: 'orden_interconsulta_quirofano.png',
    category: 'Solicitud de procedimiento',
    format: 'PNG',
    size: '890 KB',
  },
];
