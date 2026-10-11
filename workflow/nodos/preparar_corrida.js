// Entrada del webhook: valida token y archivo ANTES de gastar tokens del LLM.
const MAX_BYTES = 10 * 1024 * 1024;
const MIME_PERMITIDOS = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
// URL del backend: solo desde la configuración del servidor, nunca desde el request
// (si viniera del navegador, cualquiera podría desviar el token del usuario a otro host).
// Modelos de Gemini: el rápido procesa todo; el preciso solo repite los documentos dudosos.
// Configurables porque Google renueva los IDs (ver ai.google.dev/gemini-api/docs/models).
function leerEnv(nombre, porDefecto) {
  try {
    return $env[nombre] || porDefecto;
  } catch (e) {
    // N8N_BLOCK_ENV_ACCESS_IN_NODE=true: se usa el valor por defecto.
    return porDefecto;
  }
}
const apiBaseUrl = leerEnv('MEDIFLOW_API_BASE_URL', 'http://host.docker.internal:8000');
const modeloRapido = leerEnv('GEMINI_MODELO_RAPIDO', 'gemini-3.1-flash-lite');
const modeloPreciso = leerEnv('GEMINI_MODELO_PRECISO', 'gemini-3.8-flash');

const webhook = $('Ingesta Webhook').first();
const json = webhook.json || {};
const headers = json.headers || {};

const authHeader = headers.authorization || headers.Authorization || '';
const token = authHeader.replace(/^Bearer\s+/i, '').trim() || String((json.body || {}).token || json.token || '').trim();

// ID de seguimiento: lo genera el front y se reenvía al backend como X-Request-ID, para
// seguir la misma ingesta en los logs del navegador, de n8n y del backend.
const receivedId = String((json.body || {}).request_id || headers['x-request-id'] || '').trim();
const request_id = /^[A-Za-z0-9_-]{8,64}$/.test(receivedId)
  ? receivedId
  : 'n8n-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
if (!token) {
  throw new Error('No se recibió token de autenticación (JWT) desde el frontend');
}

const binary = webhook.binary || {};
const binaryKey = Object.keys(binary)[0];
if (!binaryKey) {
  throw new Error('No se recibió ningún archivo en el webhook');
}
const mime = (binary[binaryKey].mimeType || '').toLowerCase();
if (!MIME_PERMITIDOS.includes(mime)) {
  throw new Error('Formato no admitido (' + mime + '): use PDF, PNG o JPG');
}

// Convierte a base64 aquí: es el único nodo cuya entrada trae el binario del webhook.
// En n8n 2.x binary.data.data es solo una referencia al disco, no el contenido.
const buffer = await this.helpers.getBinaryDataBuffer(0, binaryKey);
if (buffer.length > MAX_BYTES) {
  throw new Error('El archivo supera el límite de 10 MB');
}

return [{
  json: {
    // Siempre lo genera el servidor: un único responsable evita colisiones y rutas raras en OCI.
    documento_id: 'DOC-' + (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12)),
    request_id,
    access_token: token,
    api_base_url: apiBaseUrl.replace(/\/+$/, ''),
    modelo_rapido: modeloRapido,
    modelo_preciso: modeloPreciso,
    archivo_base64: buffer.toString('base64'),
    // Gemini espera el MIME estándar de JPEG.
    archivo_mime: mime === 'image/jpg' ? 'image/jpeg' : mime
  }
}];
