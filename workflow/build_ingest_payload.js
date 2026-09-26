/**
 * Nodo Code de n8n: arma el IngestPayload de FastAPI.
 * Entrada: JSON de Gemini (clasificacion, datos_generales, detalle_clinico, decision_enrutamiento)
 * + binario del webhook (PDF/imagen).
 * Salida: body listo para POST /api/v1/documents/ingest
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

function mapTipo(tipo) {
  return TIPO_LEGACY[tipo] || tipo || "Otro / No clasificable";
}

function mapDestino(codigo, requiereHitl, urgente) {
  if (urgente) return "Cola_Emergencia_Medica";
  const mapped = DESTINO_LEGACY[codigo] || codigo;
  if (mapped === "Cola_Revision_Humana") return "Ficha_Clinica";
  return mapped || "Ficha_Clinica";
}

const item = $input.first();
const gemini = parseGemini(item.json);
const clasificacion = gemini.clasificacion || {};
const datos = gemini.datos_generales || gemini.datos_extraidos || {};
const paciente = datos.paciente || {};
const medico = datos.medico_solicitante || gemini.profesional || {};
const decision = gemini.decision_enrutamiento || {};

const score = Number(
  clasificacion.score_confianza_clasificacion ??
    gemini.documento?.confianza_clasificacion ??
    0.5
);
const tipo = mapTipo(clasificacion.tipo_documento || gemini.documento?.tipo);
let prioridad = clasificacion.nivel_prioridad || "Rutina";
if (prioridad === "Ambiguo") prioridad = "Prioritario";

const urgente =
  prioridad === "Urgente" ||
  decision.destino_principal === "Cola_Emergencia_Medica" ||
  gemini.clinico?.urgencia === true;

let hitl = Boolean(decision.requiere_auditoria_humana);
if (score < 0.7) hitl = true;
if (tipo === "Otro / No clasificable") hitl = true;
if (decision.destino_principal === "Cola_Revision_Humana") hitl = true;
if (!paciente.nombre) hitl = true;

const destino = mapDestino(decision.destino_principal || gemini.cola_destino, hitl, urgente);

const webhook = $("Ingesta Webhook").first();
const binary = webhook.binary?.data || item.binary?.data;
let archivoBase64 = "";
let tipoArchivo = "PDF";
if (binary) {
  archivoBase64 = binary.data;
  const mime = binary.mimeType || "";
  tipoArchivo = mime.includes("pdf") ? "PDF" : "IMAGEN";
}

const documentoId =
  gemini.documento_id ||
  $("Ingesta Webhook").first().json.documento_id ||
  `DOC-${Date.now()}`;

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
