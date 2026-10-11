// Traduce la respuesta del backend al contrato del front: el body tal cual si fue 2xx, o
// { status: 'error', etapa, detalle } con el mismo código HTTP si falló.
const res = $input.first().json;
const code = Number(res.statusCode) || 502;
const body = res.body && typeof res.body === 'object' ? res.body : {};
if (code >= 200 && code < 300) {
  return [{ json: { statusCode: code, body } }];
}
const detail = body.detail ?? res.body ?? 'Error desconocido del backend';
return [{
  json: {
    statusCode: code,
    body: {
      status: 'error',
      etapa: code === 401 || code === 403 ? 'AUTENTICACION' : 'INGESTA_BACKEND',
      detalle: typeof detail === 'string' ? detail : JSON.stringify(detail),
      request_id: $('Preparar corrida').first().json.request_id,
    },
  },
}];
