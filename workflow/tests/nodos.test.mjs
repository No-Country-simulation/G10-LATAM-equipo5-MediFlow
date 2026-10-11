// Tests del código de los nodos Code del workflow, ejecutado tal como lo corre n8n.
//
//   node --test workflow/tests
//
// Cada nodo es el cuerpo de una función async con los globales de n8n ($, $input, $env, this):
// aquí se ejecuta con esos globales simulados. Los fixtures de formularios y colas se generaron
// desde el backend real (GET /catalogs/document-types/forms y /queues/active).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const FORMULARIOS = JSON.parse(readFileSync(join(aqui, 'fixtures', 'formularios.json'), 'utf8'));
const COLAS = JSON.parse(readFileSync(join(aqui, 'fixtures', 'colas.json'), 'utf8'));
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

/** Ejecuta un nodo con `nodos` = { 'Nombre del nodo': [json, ...] } ya ejecutados. */
function ejecutar(archivo, { nodos = {}, input, env = {}, etapa, helpers } = {}) {
  let codigo = readFileSync(join(aqui, '..', 'nodos', archivo), 'utf8');
  if (etapa) codigo = codigo.replace('__ETAPA__', etapa);
  const $ = (nombre) => {
    if (!(nombre in nodos)) throw new Error(`El nodo "${nombre}" no se ha ejecutado`);
    const items = nodos[nombre].map((item) => (item && item.json !== undefined ? item : { json: item }));
    return { first: () => items[0], all: () => items };
  };
  const $input = { first: () => ({ json: input }) };
  return new AsyncFunction('$', '$input', '$env', codigo).call({ helpers }, $, $input, env);
}

const PREP = {
  documento_id: 'DOC-1',
  request_id: 'req-12345678',
  modelo_rapido: 'gemini-3.1-flash-lite',
  modelo_preciso: 'gemini-3.8-flash',
  archivo_base64: 'JVBERi0=',
  archivo_mime: 'application/pdf',
};

const respuestaGemini = (llm, { status = 200, fin = 'STOP' } = {}) => ({
  statusCode: status,
  body: { candidates: [{ finishReason: fin, content: { parts: [{ text: JSON.stringify(llm) }] } }] },
});

const LLM_CLARO = {
  clasificacion: { tipo_documento: 'IMAGENES', nivel_prioridad: 'Prioritario' },
  evaluacion: { legibilidad: 'alta', certeza_tipo: 'alta', campos_dudosos: [], documentos_multiples: false },
  datos_generales: { paciente: { nombre: 'Ana', identificacion: { tipo: 'RUT', numero: '1-9' } } },
  detalle_clinico: { informe_imagenologico: { hallazgos: 'Masa' } },
  decision_enrutamiento: { destino_principal: 'Cola_Oncologia', requiere_auditoria_humana: false },
};

// --- Preparar corrida ----------------------------------------------------------

const webhook = (body = {}, headers = { authorization: 'Bearer tok' }, mime = 'image/jpg') => ({
  json: { headers, body },
  binary: { data: { mimeType: mime } },
});
const helpers = (bytes = 10) => ({ getBinaryDataBuffer: async () => Buffer.alloc(bytes) });

test('preparar corrida: reusa el request_id del front y lee los modelos del entorno', async () => {
  const [{ json }] = await ejecutar('preparar_corrida.js', {
    nodos: { 'Ingesta Webhook': [webhook({ request_id: 'front-abc12345' })] },
    env: { GEMINI_MODELO_PRECISO: 'gemini-x' },
    helpers: helpers(),
  });
  assert.equal(json.request_id, 'front-abc12345');
  assert.equal(json.modelo_rapido, 'gemini-3.1-flash-lite');
  assert.equal(json.modelo_preciso, 'gemini-x');
  assert.equal(json.archivo_mime, 'image/jpeg'); // MIME estándar para Gemini
  assert.match(json.documento_id, /^DOC-/);
});

test('preparar corrida: genera un request_id si el recibido no es seguro', async () => {
  const [{ json }] = await ejecutar('preparar_corrida.js', {
    nodos: { 'Ingesta Webhook': [webhook({ request_id: 'x; DROP' })] },
    helpers: helpers(),
  });
  assert.match(json.request_id, /^n8n-/);
});

test('preparar corrida: rechaza sin token o con un archivo no admitido', async () => {
  await assert.rejects(
    ejecutar('preparar_corrida.js', { nodos: { 'Ingesta Webhook': [webhook({}, {})] }, helpers: helpers() }),
    /token/,
  );
  await assert.rejects(
    ejecutar('preparar_corrida.js', {
      nodos: { 'Ingesta Webhook': [webhook({}, undefined, 'text/plain')] },
      helpers: helpers(),
    }),
    /Formato no admitido/,
  );
});

// --- Contexto para IA ------------------------------------------------------------

test('contexto: prompt con todos los tipos, sus campos y las colas; archivo adjunto al final', async () => {
  const [{ json }] = await ejecutar('contexto_ia.js', {
    nodos: { 'Preparar corrida': [PREP], 'GET formularios': [FORMULARIOS], 'GET colas activas': [COLAS] },
  });
  const [parteTexto, parteArchivo] = json.gemini_request.contents[0].parts;
  const prompt = parteTexto.text;

  for (const tipo of FORMULARIOS.tipos) assert.ok(prompt.includes(`- ${tipo.codigo} (`), tipo.codigo);
  assert.ok(prompt.includes('bloque informe_imagenologico:{estudio_realizado,modalidad:(RX|TC|RM|ECO|'));
  assert.ok(prompt.includes('parametros:[{nombre,valor,unidad,rango_referencia,alterado:bool,critico:bool}]'));
  assert.ok(prompt.includes('bloque campos_adicionales:{tipo_certificado:(ATENCION|'));
  assert.ok(prompt.includes('signos_vitales:{presion_arterial,'));
  assert.ok(prompt.includes('- Cola_Oncologia (Oncología) [NOTIFICAR]'));
  assert.deepEqual(parteArchivo, { inline_data: { mime_type: 'application/pdf', data: 'JVBERi0=' } });
  assert.equal(json.gemini_request.generationConfig.responseMimeType, 'application/json');
  assert.equal(json.gemini_request.generationConfig.temperature, 0);
});

test('contexto: el prompt cabe holgado en el presupuesto de tokens', async () => {
  const [{ json }] = await ejecutar('contexto_ia.js', {
    nodos: { 'Preparar corrida': [PREP], 'GET formularios': [FORMULARIOS], 'GET colas activas': [COLAS] },
  });
  // ~4 caracteres por token: menos de ~6.5k tokens de instrucciones y catálogos.
  assert.ok(json.largo_prompt < 26000, `prompt de ${json.largo_prompt} caracteres`);
});

// --- Interpretar respuesta ---------------------------------------------------------

const interpretarRapida = (respuesta, prep = PREP) =>
  ejecutar('interpretar_respuesta.js', { etapa: 'rapida', input: respuesta, nodos: { 'Preparar corrida': [prep] } });

test('interpretar: respuesta clara del modelo rápido no se escala', async () => {
  const [{ json }] = await interpretarRapida(respuestaGemini(LLM_CLARO));
  assert.equal(json.escalar, false);
  assert.equal(json.modelo, 'gemini-3.1-flash-lite');
  assert.equal(json.llm.clasificacion.tipo_documento, 'IMAGENES');
});

test('interpretar: dudas, errores o respuestas cortadas se escalan con su motivo', async () => {
  const dudosa = { ...LLM_CLARO, evaluacion: { legibilidad: 'media', certeza_tipo: 'alta', campos_dudosos: ['x'] } };
  const casos = [
    [respuestaGemini(dudosa), ['legibilidad media', 'campos dudosos']],
    [{ statusCode: 503, body: { error: { message: 'overloaded' } } }, ['Gemini respondió HTTP 503: overloaded']],
    [respuestaGemini(LLM_CLARO, { fin: 'MAX_TOKENS' }), ['La respuesta de Gemini quedó cortada (MAX_TOKENS)']],
    [{ statusCode: 200, body: { candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }] } }, ['Gemini no devolvió un JSON válido (SAFETY)']],
  ];
  for (const [respuesta, motivos] of casos) {
    const [{ json }] = await interpretarRapida(respuesta);
    assert.equal(json.escalar, true);
    assert.deepEqual(json.motivos_escalamiento, motivos);
  }
});

test('interpretar: acepta JSON envuelto en texto (```json ... ```)', async () => {
  const respuesta = { statusCode: 200, body: { candidates: [{ content: { parts: [{ text: '```json\n' + JSON.stringify(LLM_CLARO) + '\n```' }] } }] } };
  const [{ json }] = await interpretarRapida(respuesta);
  assert.equal(json.llm.clasificacion.tipo_documento, 'IMAGENES');
});

test('interpretar: sin modelo preciso distinto no se escala', async () => {
  const dudosa = { ...LLM_CLARO, evaluacion: { legibilidad: 'baja', certeza_tipo: 'baja' } };
  const [{ json }] = await interpretarRapida(respuestaGemini(dudosa), { ...PREP, modelo_preciso: PREP.modelo_rapido });
  assert.equal(json.escalar, false);
});

test('interpretar (precisa): usa el modelo preciso o, si falla, la respuesta rápida', async () => {
  const rapida = { llm: LLM_CLARO, modelo: PREP.modelo_rapido, motivos_escalamiento: ['legibilidad media'] };
  const nodos = { 'Preparar corrida': [PREP], 'Interpretar respuesta rápida': [rapida] };
  const precisaOk = { ...LLM_CLARO, clasificacion: { tipo_documento: 'LABORATORIO', nivel_prioridad: 'Rutina' } };

  const [{ json: ok }] = await ejecutar('interpretar_respuesta.js', { etapa: 'precisa', input: respuestaGemini(precisaOk), nodos });
  assert.deepEqual([ok.llm.clasificacion.tipo_documento, ok.modelo, ok.escalado], ['LABORATORIO', 'gemini-3.8-flash', true]);

  const [{ json: respaldo }] = await ejecutar('interpretar_respuesta.js', { etapa: 'precisa', input: { statusCode: 500, body: {} }, nodos });
  assert.deepEqual([respaldo.llm.clasificacion.tipo_documento, respaldo.modelo], ['IMAGENES', 'gemini-3.1-flash-lite']);
});

// --- Armar IngestPayload -------------------------------------------------------------

const armar = (resultado) =>
  ejecutar('armar_ingest_payload.js', {
    input: resultado,
    nodos: { 'Preparar corrida': [PREP], 'GET formularios': [FORMULARIOS], 'GET colas activas': [COLAS] },
  });

test('armar payload: contrato v2 con evaluación, modelo y escalamiento', async () => {
  const [{ json }] = await armar({ llm: LLM_CLARO, modelo: 'gemini-3.8-flash', escalado: true });
  assert.equal(json.clasificacion.tipo_documento, 'IMAGENES');
  assert.equal(json.clasificacion.score_confianza_clasificacion, null); // lo calcula el backend
  assert.deepEqual([json.evaluacion.modelo, json.evaluacion.escalado, json.evaluacion.legibilidad], ['gemini-3.8-flash', true, 'alta']);
  assert.deepEqual(json.datos_generales.paciente.identificacion, { tipo: 'RUT', numero: '1-9' });
  assert.deepEqual(json.archivos[0], { tipo_archivo: 'PDF', archivo_base64: 'JVBERi0=', rol: 'documento_principal' });
  assert.equal(json.decision_enrutamiento.requiere_auditoria_humana, false);
});

test('armar payload: tipo por nombre se traduce y uno inexistente pasa a OTRO con auditoría', async () => {
  const porNombre = { ...LLM_CLARO, clasificacion: { tipo_documento: 'Receta Médica', nivel_prioridad: 'Rutina' } };
  assert.equal((await armar({ llm: porNombre }))[0].json.clasificacion.tipo_documento, 'RECETA');

  const inventado = { ...LLM_CLARO, clasificacion: { tipo_documento: 'BOLETA', nivel_prioridad: 'Alta' } };
  const [{ json }] = await armar({ llm: inventado });
  assert.deepEqual([json.clasificacion.tipo_documento, json.clasificacion.nivel_prioridad], ['OTRO', 'Prioritario']);
  assert.equal(json.decision_enrutamiento.requiere_auditoria_humana, true);
});

test('armar payload: sin respuesta válida queda para auditoría con el motivo', async () => {
  const [{ json }] = await armar({ llm: null, fallo: 'Gemini respondió HTTP 503', modelo: 'gemini-3.8-flash', escalado: true });
  assert.equal(json.clasificacion.tipo_documento, 'OTRO');
  assert.deepEqual([json.evaluacion.legibilidad, json.evaluacion.certeza_tipo], ['baja', 'baja']);
  assert.equal(json.decision_enrutamiento.destino_principal, 'Ficha_Clinica');
  assert.equal(json.decision_enrutamiento.justificacion_enrutamiento, 'Gemini respondió HTTP 503');
  assert.equal(json.decision_enrutamiento.requiere_auditoria_humana, true);
});
