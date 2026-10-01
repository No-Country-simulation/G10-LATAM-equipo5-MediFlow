/**
 * Nodo Code de n8n: arma el IngestPayload de FastAPI.
 *
 * documento_id sale SOLO de "Preparar corrida" (creado al inicio).
 * Si el webhook reenvía el mismo ID, FastAPI actualiza el mismo registro (idempotencia).
 * El Bearer sale de "Login FastAPI", no de una variable de entorno.
 */
const DESTINO_LEGACY = {
  Historia_Clinica_Electronica: "Ficha_Clinica",
  Cola_Revision_Humana: "Ficha_Clinica",
  Auditoria_Autorizaciones: "Gestion_Procedimientos",
  COLA_URGENCIAS_PRIORITARIA: "Cola_Emergencia_Medica",
  FARMACIA_DESPACHO: "Farmacia_Hospitalaria",
  AUDITORIA_AUTORIZACIONES: "Gestion_Procedimientos",
  HISTORIA_CLINICA_ELECTRONICA: "Ficha_Clinica",
  REVISION_HUMANA_PENDIENTE: "Ficha_Clinica",
};

const TIPO_LEGACY = {
  "Informe de Estudio por Imágenes/Laboratorio": "Informe de Estudio por Imágenes",
  "Informe de Estudio de Diagnóstico": "Informe de Estudio por Imágenes",
  "Orden de Solicitud de Procedimiento": "Solicitud de Procedimiento",
  "Urgencias Médicas": "Otro / No clasificable",
  Desconocido: "Otro / No clasificable",
  "Certificado Médico": "Otro / No clasificable",
};

function parseGemini(raw) {
  if (raw && raw.clasificacion) return raw;
  const text = typeof raw === "string" ? raw : raw?.text || raw?.output || JSON.stringify(raw || {});
  const match = String(text).match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]);
  } catch {
    return {};
  }
}

function listFrom(nodeName) {
  try {
    const items = $(nodeName).all();
    if (items.length === 1 && Array.isArray(items[0].json)) {
      return items[0].json;
    }
    return items.map((i) => i.json);
  } catch {
    return [];
  }
}

function nombresTipo(catalogo) {
  return new Set(catalogo.map((t) => t.nombre).filter(Boolean));
}

function codigosCola(catalogo) {
  return new Set(catalogo.map((c) => c.codigo).filter(Boolean));
}

const item = $input.first();
const gemini = parseGemini(item.json);
const clasificacion = gemini.clasificacion || {};
const datos = gemini.datos_generales || gemini.datos_extraidos || {};
const paciente = datos.paciente || {};
const medico = datos.medico_solicitante || gemini.profesional || {};
const decision = gemini.decision_enrutamiento || {};
const prep = $("Preparar corrida").first();
const tipos = listFrom("GET tipos activos");
const colas = listFrom("GET colas activas");
const tiposValidos = nombresTipo(tipos);
const colasValidas = codigosCola(colas);

const score = Number(
  clasificacion.score_confianza_clasificacion ??
    gemini.documento?.confianza_clasificacion ??
    0.5
);

let tipo = TIPO_LEGACY[clasificacion.tipo_documento || gemini.documento?.tipo]
  || clasificacion.tipo_documento
  || gemini.documento?.tipo
  || "Otro / No clasificable";
if (tiposValidos.size && !tiposValidos.has(tipo)) {
  tipo = [...tiposValidos].find((n) => n.startsWith("Otro")) || "Otro / No clasificable";
}

let prioridad = clasificacion.nivel_prioridad || "Rutina";
if (prioridad === "Ambiguo") prioridad = "Prioritario";

const urgente =
  prioridad === "Urgente" ||
  decision.destino_principal === "Cola_Emergencia_Medica" ||
  gemini.clinico?.urgencia === true;

let hitl = Boolean(decision.requiere_auditoria_humana);
if (score < 0.7) hitl = true;
if (String(tipo).startsWith("Otro")) hitl = true;
if (decision.destino_principal === "Cola_Revision_Humana") hitl = true;
if (!paciente.nombre && !paciente.nombre_completo) hitl = true;

let destino = urgente ? "Cola_Emergencia_Medica" : (DESTINO_LEGACY[decision.destino_principal] || decision.destino_principal);
if (!destino || (colasValidas.size && !colasValidas.has(destino))) {
  destino = colasValidas.has("Ficha_Clinica") ? "Ficha_Clinica" : [...colasValidas][0] || "Ficha_Clinica";
  if (!urgente) hitl = true;
}

const binary = prep.binary?.data || item.binary?.data;
let archivoBase64 = "";
let tipoArchivo = "PDF";
if (binary) {
  archivoBase64 = binary.data;
  tipoArchivo = (binary.mimeType || "").includes("pdf") ? "PDF" : "IMAGEN";
}

const documentoId = prep.json.documento_id;
if (!documentoId) {
  throw new Error("Falta documento_id de Preparar corrida; no se puede ingresar sin idempotencia.");
}

return [
  {
    json: {
      documento_id: String(documentoId),
      archivos: [
        {
          tipo_archivo: tipoArchivo,
          archivo_base64: archivoBase64,
          rol: "documento_principal",
        },
      ],
      clasificacion: {
        tipo_documento: tipo,
        especialidad: clasificacion.especialidad || null,
        nivel_prioridad: urgente ? "Urgente" : prioridad,
        score_confianza_clasificacion: score,
      },
      datos_generales: {
        paciente: {
          rut: paciente.rut || paciente.identificacion || null,
          nombre: paciente.nombre || paciente.nombre_completo || null,
          edad: paciente.edad ?? null,
        },
        medico_solicitante: {
          rut: medico.rut || null,
          nombre: medico.nombre || medico.nombre_completo || null,
          matricula: medico.matricula || null,
        },
        diagnostico_principal:
          datos.diagnostico_principal || gemini.clinico?.hipotesis_diagnostica || null,
        cie10_sugerido: datos.cie10_sugerido || gemini.clinico?.codigo_cie10 || null,
      },
      detalle_clinico: gemini.detalle_clinico || {
        medicamentos: null,
        examenes_y_laboratorio: null,
        procedimientos_e_internacion: null,
        informe_imagenologico: null,
        nota_atencion_ambulatoria: null,
      },
      decision_enrutamiento: {
        destino_principal: destino,
        requiere_auditoria_humana: hitl,
        justificacion_enrutamiento:
          decision.justificacion_enrutamiento ||
          (hitl ? "Baja confianza o datos incompletos" : "Enrutamiento automático"),
        notificacion_generada: decision.notificacion_generada || null,
      },
    },
  },
];
