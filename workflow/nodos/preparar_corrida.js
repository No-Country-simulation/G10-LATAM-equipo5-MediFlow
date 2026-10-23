// Entrada del webhook: valida token y archivo ANTES de gastar tokens del LLM.
const MAX_BYTES = 10 * 1024 * 1024;
// Los TXT/JSON van como texto dentro del prompt: 1 MB ya son ~250 mil tokens.
const MAX_BYTES_TEXTO = 1 * 1024 * 1024;
const MIME_PERMITIDOS = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'text/plain', 'application/json'];
const MIME_TEXTO = ['text/plain', 'application/json'];
// Algunos navegadores envían un .json o .txt sin MIME o como octet-stream: manda la extensión.
const MIME_POR_EXTENSION = { '.txt': 'text/plain', '.json': 'application/json' };
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
const nombreArchivo = String(binary[binaryKey].fileName || '').toLowerCase();
const extension = Object.keys(MIME_POR_EXTENSION).find((ext) => nombreArchivo.endsWith(ext));
const mime = extension
  ? MIME_POR_EXTENSION[extension]
  : (binary[binaryKey].mimeType || '').toLowerCase().split(';')[0].trim();
if (!MIME_PERMITIDOS.includes(mime)) {
  throw new Error('Formato no admitido (' + mime + '): use PDF, PNG, JPG, TXT o JSON');
}

// Convierte a base64 aquí: es el único nodo cuya entrada trae el binario del webhook.
// En n8n 2.x binary.data.data es solo una referencia al disco, no el contenido.
let buffer = await this.helpers.getBinaryDataBuffer(0, binaryKey);
if (buffer.length > MAX_BYTES) {
  throw new Error('El archivo supera el límite de 10 MB');
}

// Texto: se valida antes de gastar tokens (UTF-8 y, si es JSON, que se pueda parsear).
if (MIME_TEXTO.includes(mime)) {
  if (buffer.length > MAX_BYTES_TEXTO) {
    throw new Error('El archivo de texto supera el límite de 1 MB');
  }
  // Un byte que no es UTF-8 se decodifica como U+FFFD y el texto ya no vuelve a los mismos bytes.
  const decodificado = buffer.toString('utf8');
  if (!Buffer.from(decodificado, 'utf8').equals(buffer)) {
    throw new Error('El archivo de texto no está codificado en UTF-8');
  }
  // Sin BOM (lo agrega el Bloc de notas): JSON.parse lo rechazaría.
  const texto = decodificado.replace(/^\uFEFF/, '');
  if (mime === 'application/json') {
    try {
      JSON.parse(texto);
    } catch (e) {
      throw new Error('El archivo JSON no es válido: ' + e.message);
    }
  }
  buffer = Buffer.from(texto, 'utf8');
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
