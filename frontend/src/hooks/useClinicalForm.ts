import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { CorreccionClinica, DatosGenerales, NivelPrioridad } from '../types/medical';
import type { DocumentForms, JsonObject, JsonValue } from '../types/forms';
import { datosGeneralesDesdeJson, detalleParaTipo, validarAuditoria } from '../utils/auditForm';

export interface ClasificacionForm {
  tipo_documento: string;
  nivel_prioridad: NivelPrioridad;
  destino_enrutamiento: string;
  especialidad: string;
}

export interface ValoresClinicos {
  clasificacion: ClasificacionForm;
  datosGenerales: JsonObject;
  detalle: JsonObject;
}

const VALORES_VACIOS: ValoresClinicos = {
  clasificacion: { tipo_documento: '', nivel_prioridad: 'Rutina', destino_enrutamiento: '', especialidad: '' },
  datosGenerales: {},
  detalle: {},
};

interface DocumentoClasificado {
  tipo_documento: string;
  nivel_prioridad: NivelPrioridad;
  destino_enrutamiento: string | null;
  especialidad?: string | null;
}

/** Valores del formulario desde un documento y su JSON vigente (`datos_generales`, `detalle_clinico`). */
export const valoresDesdeDocumento = (
  documento: DocumentoClasificado,
  json: { datos_generales?: unknown; detalle_clinico?: unknown } | null | undefined
): ValoresClinicos => ({
  clasificacion: {
    tipo_documento: documento.tipo_documento,
    nivel_prioridad: documento.nivel_prioridad,
    destino_enrutamiento: documento.destino_enrutamiento || '',
    especialidad: documento.especialidad || '',
  },
  datosGenerales: datosGeneralesDesdeJson(json as Record<string, unknown> | null | undefined),
  detalle: (json?.detalle_clinico as JsonObject | undefined) ?? {},
});

/**
 * Estado del formulario clínico que comparten la auditoría y la corrección de documentos. Usa la
 * misma estructura que la ingesta (`datos_generales` y `detalle_clinico`), con los campos del tipo
 * elegido (ver GET /catalogs/document-types/forms).
 */
export const useClinicalForm = (forms: DocumentForms | null, inicial: ValoresClinicos = VALORES_VACIOS) => {
  const [clasificacion, setClasificacion] = useState<ClasificacionForm>(inicial.clasificacion);
  const [datosGenerales, setDatosGenerales] = useState<JsonObject>(inicial.datosGenerales);
  const [detalle, setDetalle] = useState<JsonObject>(inicial.detalle);
  const [notas, setNotas] = useState('');
  // Bloques del detalle que se ocultaron al cambiar de tipo: si se vuelve a ese tipo, se restauran.
  const bloquesOcultos = useRef<JsonObject>({});

  const cargar = useCallback((valores: ValoresClinicos) => {
    setClasificacion(valores.clasificacion);
    setDatosGenerales(valores.datosGenerales);
    setDetalle(valores.detalle);
    bloquesOcultos.current = {};
  }, []);

  const handleClasificacionChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setClasificacion((prev) => ({ ...prev, [name]: value }));
    // Al cambiar de tipo cambian sus campos: el bloque del tipo anterior se oculta (el backend lo
    // rechazaría) y, si se vuelve a ese tipo, reaparece con lo que tenía.
    if (name === 'tipo_documento') {
      setDetalle((prev) => {
        const visible = detalleParaTipo(prev, value, forms);
        for (const [clave, bloque] of Object.entries(prev)) {
          if (!(clave in visible)) bloquesOcultos.current[clave] = bloque;
        }
        const bloqueNuevo = forms?.tipos.find((t) => t.codigo === value)?.bloque;
        if (bloqueNuevo && !(bloqueNuevo in visible) && bloqueNuevo in bloquesOcultos.current) {
          return { ...visible, [bloqueNuevo]: bloquesOcultos.current[bloqueNuevo] };
        }
        return visible;
      });
    }
  };

  const setCampoDetalle = (bloque: string, valor: JsonValue) => setDetalle((prev) => ({ ...prev, [bloque]: valor }));

  /** Primer problema a corregir antes de enviar, o `null` (el backend vuelve a validar todo). */
  const validar = (): string | null => validarAuditoria(datosGenerales, notas);

  /** Cuerpo común de la petición (sin la nota/justificación, que cada caso nombra distinto). */
  const valoresParaEnviar = (): CorreccionClinica => ({
    tipo_documento: clasificacion.tipo_documento,
    nivel_prioridad: clasificacion.nivel_prioridad,
    destino_enrutamiento: clasificacion.destino_enrutamiento,
    especialidad: clasificacion.especialidad || null,
    datos_generales: datosGenerales as unknown as DatosGenerales,
    detalle_clinico: detalleParaTipo(detalle, clasificacion.tipo_documento, forms),
  });

  return {
    clasificacion,
    datosGenerales,
    detalle,
    notas,
    cargar,
    handleClasificacionChange,
    setDatosGenerales,
    setCampoDetalle,
    setNotas,
    validar,
    valoresParaEnviar,
  };
};
