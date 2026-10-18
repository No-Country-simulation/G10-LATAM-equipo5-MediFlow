import { Building2, FileText, Route, type LucideIcon } from 'lucide-react';
import { catalogService, type CatalogApi } from '../../services/catalogService';
import type { UserRole } from '../../types/auth';
import type { CatalogRecord, DocumentTypeRecord, QueueRecord } from '../../types/catalog';

export type CatalogKey = 'documentTypes' | 'areas' | 'queues';

export type FieldKind = 'text' | 'textarea' | 'json' | 'checkbox';

/** Campo del formulario de un catálogo. Los límites y formatos replican la validación del backend. */
export interface CatalogField {
  name: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  hint?: string;
  /** Solo se envía al crear (el `codigo` es inmutable). */
  createOnly?: boolean;
  /** No aplica a los registros `es_sistema`: al editarlos se oculta y no se envía. */
  hiddenForSystem?: boolean;
  pattern?: string;
  patternTitle?: string;
  uppercase?: boolean;
}

export interface RecordBadge {
  label: string;
  tone: 'amber' | 'violet' | 'emerald';
}

export interface CatalogDefinition {
  key: CatalogKey;
  /** Etiqueta de la pestaña. */
  label: string;
  /** Nombre en singular, para títulos y mensajes ("Nuevo tipo de documento"). */
  singular: string;
  /** Texto del botón y del título de alta, con el género correcto ("Nueva área"). */
  newLabel: string;
  icon: LucideIcon;
  subtitle: string;
  api: CatalogApi<CatalogRecord>;
  fields: CatalogField[];
  /** Campo de texto largo que se muestra (recortado) en la tabla. */
  descriptionField: string;
  /** Insignias adicionales de la fila (ej. notificación inmediata, aparece en Triaje). */
  badges?: (record: CatalogRecord) => RecordBadge[];
  /** Roles que ven la pestaña y pueden modificar el catálogo (igual que el backend). */
  managerRoles: UserRole[];
}

const UPPERCASE_CODE = '[A-Z0-9_]+';
const UPPERCASE_CODE_TITLE = 'Solo mayúsculas, números y guion bajo (ej. LICENCIA_MEDICA)';

const codigoField = (maxLength: number, placeholder: string, uppercase = true): CatalogField => ({
  name: 'codigo',
  label: 'Código',
  kind: 'text',
  required: true,
  maxLength,
  placeholder,
  createOnly: true,
  uppercase,
  pattern: uppercase ? UPPERCASE_CODE : '[A-Za-z0-9_]+',
  patternTitle: uppercase ? UPPERCASE_CODE_TITLE : 'Letras, números y guion bajo, sin espacios (ej. Gestion_GES)',
  hint: 'No se puede modificar después: los documentos y usuarios lo referencian.',
});

const nombreField = (maxLength: number, placeholder: string): CatalogField => ({
  name: 'nombre',
  label: 'Nombre',
  kind: 'text',
  required: true,
  maxLength,
  placeholder,
});

export const CATALOGS: CatalogDefinition[] = [
  {
    key: 'documentTypes',
    label: 'Tipos de Documento',
    singular: 'tipo de documento',
    newLabel: 'Nuevo tipo de documento',
    icon: FileText,
    subtitle: 'Clases de documento clínico que la IA puede asignar; la descripción guía al LLM.',
    api: catalogService.documentTypes as CatalogApi<CatalogRecord>,
    descriptionField: 'descripcion',
    managerRoles: ['ADMIN'],
    fields: [
      codigoField(50, 'LICENCIA_MEDICA'),
      nombreField(80, 'Licencia Médica'),
      {
        name: 'descripcion',
        label: 'Descripción para la IA',
        kind: 'textarea',
        required: true,
        placeholder: 'Cuándo SÍ y cuándo NO usar este tipo...',
        hint: 'El LLM la lee para decidir si un documento corresponde a este tipo.',
      },
      {
        name: 'campos_extraccion',
        label: 'Campos adicionales (JSON Schema, opcional)',
        kind: 'json',
        placeholder: '{\n  "type": "object",\n  "properties": {\n    "dias_reposo": { "type": "integer", "title": "Días de reposo" }\n  }\n}',
        hint: 'Debe ser un objeto con "type": "object". Vacío = sin campos adicionales.',
      },
    ],
    badges: (record) =>
      (record as DocumentTypeRecord).campos_extraccion ? [{ label: 'Campos extra', tone: 'violet' }] : [],
  },
  {
    key: 'areas',
    label: 'Áreas',
    singular: 'área',
    newLabel: 'Nueva área',
    icon: Building2,
    subtitle: 'Áreas o servicios del hospital; cada usuario pertenece a una y los documentos registran su área de origen.',
    api: catalogService.areas as CatalogApi<CatalogRecord>,
    descriptionField: 'descripcion',
    managerRoles: ['ADMIN', 'GESTOR_USUARIOS'],
    fields: [
      codigoField(50, 'KINESIOLOGIA'),
      nombreField(150, 'Kinesiología'),
      { name: 'descripcion', label: 'Descripción (opcional)', kind: 'textarea', placeholder: 'Servicio de rehabilitación...' },
    ],
  },
  {
    key: 'queues',
    label: 'Colas de Enrutamiento',
    singular: 'cola',
    newLabel: 'Nueva cola',
    icon: Route,
    subtitle: 'Destinos a los que la IA puede derivar un documento; la descripción semántica guía al LLM.',
    api: catalogService.queues as CatalogApi<CatalogRecord>,
    descriptionField: 'descripcion_semantica',
    managerRoles: ['ADMIN'],
    fields: [
      codigoField(80, 'Gestion_GES', false),
      nombreField(150, 'Gestión GES'),
      {
        name: 'descripcion_semantica',
        label: 'Descripción semántica para la IA',
        kind: 'textarea',
        required: true,
        placeholder: 'Usar SOLO si... NO usar para...',
        hint: 'El LLM la lee para decidir cuándo enrutar a esta cola.',
      },
      {
        name: 'es_asistencial',
        label: 'Aparece en la Consola de Triaje',
        kind: 'checkbox',
        hint: 'Cola de atención directa a pacientes: sus casos se atienden desde Triaje.',
        // Ficha Clínica (de sistema) la ven todos los usuarios: no va a Triaje ni se asigna.
        hiddenForSystem: true,
      },
    ],
    badges: (record) => ((record as QueueRecord).es_asistencial ? [{ label: 'Triaje', tone: 'emerald' }] : []),
  },
];

export const catalogsForRole = (role?: UserRole): CatalogDefinition[] =>
  role ? CATALOGS.filter((catalog) => catalog.managerRoles.includes(role)) : [];
