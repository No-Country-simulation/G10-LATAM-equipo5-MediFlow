// Arma MediFlow_unificado.json a partir del código de los nodos en ./nodos.
//
//   node workflow/construir_workflow.mjs
//
// El código de los nodos Code vive en archivos .js (legibles, versionables y con tests en
// ./tests); este script lo inserta en el JSON que se importa en n8n. Después de editar un nodo,
// vuelve a ejecutarlo y re-importa el workflow.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = dirname(fileURLToPath(import.meta.url));
const codigo = (archivo) => readFileSync(join(raiz, 'nodos', archivo), 'utf8');

// Credencial de Gemini ya creada en la instancia de n8n (se reasigna al importar si cambia).
const CREDENCIAL_GEMINI = { googlePalmApi: { id: 'uoXc6pOzbUGOZEa9', name: 'Google Gemini(PaLM) Api account' } };
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';
const PREP = "$('Preparar corrida').first().json";
const REQUEST_ID = `={{ ${PREP}.request_id }}`;
const AUTH = `=Bearer {{ ${PREP}.access_token }}`;

const nodoCode = (id, name, position, jsCode) => ({
  parameters: { jsCode },
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position,
  id,
  name,
});

const getBackend = (id, name, position, ruta) => ({
  parameters: {
    method: 'GET',
    url: `={{ ${PREP}.api_base_url }}${ruta}`,
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'Authorization', value: AUTH },
        { name: 'X-Request-ID', value: REQUEST_ID },
      ],
    },
    options: {},
  },
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position,
  id,
  name,
});

// Llamada directa a generateContent: el archivo va adjunto (PDF o imagen) y la respuesta en modo
// JSON. `neverError` deja que "Interpretar respuesta" decida qué hacer con un error HTTP.
const geminiHttp = (id, name, position, campoModelo) => ({
  parameters: {
    method: 'POST',
    url: `=${GEMINI_URL}{{ ${PREP}.${campoModelo} }}:generateContent`,
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'googlePalmApi',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: "={{ JSON.stringify($('Contexto para IA').first().json.gemini_request) }}",
    options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 90000 },
  },
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position,
  id,
  name,
  credentials: CREDENCIAL_GEMINI,
});

const interpretar = codigo('interpretar_respuesta.js');

const nodes = [
  {
    parameters: { httpMethod: 'POST', path: 'triaje-medico', responseMode: 'responseNode', options: {} },
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2,
    position: [-1400, 0],
    id: 'webhook-ingesta-001',
    name: 'Ingesta Webhook',
  },
  nodoCode('preparar-corrida-01', 'Preparar corrida', [-1180, 0], codigo('preparar_corrida.js')),
  getBackend('get-formularios-01', 'GET formularios', [-960, 0], '/api/v1/catalogs/document-types/forms'),
  getBackend('get-colas-01', 'GET colas activas', [-740, 0], '/api/v1/catalogs/queues/active'),
  nodoCode('contexto-ia-01', 'Contexto para IA', [-520, 0], codigo('contexto_ia.js')),
  geminiHttp('gemini-rapido-01', 'Gemini rápido', [-300, 0], 'modelo_rapido'),
  nodoCode('interpretar-rapida-01', 'Interpretar respuesta rápida', [-80, 0], interpretar.replace('__ETAPA__', 'rapida')),
  {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          {
            id: 'cond-escalar',
            leftValue: '={{ $json.escalar }}',
            rightValue: true,
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
        combinator: 'and',
      },
      options: {},
    },
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [140, 0],
    id: 'escalar-01',
    name: '¿Escalar?',
  },
  geminiHttp('gemini-preciso-01', 'Gemini preciso', [360, -140], 'modelo_preciso'),
  nodoCode('interpretar-precisa-01', 'Interpretar respuesta precisa', [580, -140], interpretar.replace('__ETAPA__', 'precisa')),
  nodoCode('armar-payload-01', 'Armar IngestPayload', [800, 0], codigo('armar_ingest_payload.js')),
  {
    parameters: {
      method: 'POST',
      url: `={{ ${PREP}.api_base_url }}/api/v1/documents/ingest`,
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Authorization', value: AUTH },
          { name: 'X-Request-ID', value: REQUEST_ID },
        ],
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json) }}',
      options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 60000 },
    },
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [1020, 0],
    id: 'post-ingest-01',
    name: 'POST FastAPI Ingest',
  },
  nodoCode('formatear-respuesta-01', 'Formatear respuesta', [1240, 0], codigo('formatear_respuesta.js')),
  {
    parameters: {
      respondWith: 'json',
      responseBody: '={{ JSON.stringify($json.body) }}',
      options: { responseCode: '={{ $json.statusCode }}' },
    },
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.1,
    position: [1460, 0],
    id: 'responder-01',
    name: 'Responder JSON',
  },
];

const enlace = (...destinos) => ({ main: destinos.map((d) => (d ? [{ node: d, type: 'main', index: 0 }] : [])) });

const connections = {
  'Ingesta Webhook': enlace('Preparar corrida'),
  'Preparar corrida': enlace('GET formularios'),
  'GET formularios': enlace('GET colas activas'),
  'GET colas activas': enlace('Contexto para IA'),
  'Contexto para IA': enlace('Gemini rápido'),
  'Gemini rápido': enlace('Interpretar respuesta rápida'),
  'Interpretar respuesta rápida': enlace('¿Escalar?'),
  '¿Escalar?': enlace('Gemini preciso', 'Armar IngestPayload'),
  'Gemini preciso': enlace('Interpretar respuesta precisa'),
  'Interpretar respuesta precisa': enlace('Armar IngestPayload'),
  'Armar IngestPayload': enlace('POST FastAPI Ingest'),
  'POST FastAPI Ingest': enlace('Formatear respuesta'),
  'Formatear respuesta': enlace('Responder JSON'),
};

const workflow = {
  name: 'MediFlow Unificado - Pipeline Multimodal e Ingesta FastAPI',
  nodes,
  connections,
  active: false,
  settings: {
    executionOrder: 'v1',
    binaryMode: 'separate',
    saveDataSuccessExecution: 'none',
    saveManualExecutions: false,
  },
  meta: { templateCredsSetupCompleted: true, instanceId: 'mediflow-production-integration' },
  id: 'mediflow-unificado',
  versionId: 'mediflow-unificado-v3',
  tags: [],
};

writeFileSync(join(raiz, 'MediFlow_unificado.json'), JSON.stringify(workflow, null, 2) + '\n');
console.log(`MediFlow_unificado.json: ${nodes.length} nodos`);
