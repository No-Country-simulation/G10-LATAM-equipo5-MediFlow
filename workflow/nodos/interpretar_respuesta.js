// Nodos "Interpretar respuesta rápida" e "Interpretar respuesta precisa" (mismo código; el script
// de armado reemplaza ETAPA por 'rapida' o 'precisa').
//
// Extrae el JSON que devolvió Gemini y decide si hay que ESCALAR: repetir la extracción con el
// modelo preciso cuando el rápido no está seguro (legibilidad o certeza no "alta", campos dudosos,
// varios documentos en el archivo) o su respuesta no sirve (error HTTP, JSON inválido o cortado).
// En la etapa precisa, si el modelo preciso falla, se conserva la respuesta del rápido.

const ETAPA = '__ETAPA__';

/** Texto, motivo de término y error de la respuesta HTTP de generateContent. */
function leerRespuesta(respuesta) {
  const body = respuesta && respuesta.body !== undefined ? respuesta.body : respuesta;
  const candidato = body && Array.isArray(body.candidates) ? body.candidates[0] : null;
  const partes = (candidato && candidato.content && candidato.content.parts) || [];
  return {
    texto: partes.map((p) => p.text || '').join(''),
    fin: candidato ? candidato.finishReason : null,
    status: respuesta && respuesta.statusCode,
    error: body && body.error ? body.error.message : null,
  };
}

function parsearJson(texto) {
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    const match = String(texto).match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

/** Resultado de la etapa: `llm` es `null` si la respuesta no se pudo usar. */
function interpretar(respuesta) {
  const { texto, fin, status, error } = leerRespuesta(respuesta);
  if (status && status >= 400) return { llm: null, fallo: 'Gemini respondió HTTP ' + status + (error ? ': ' + error : '') };
  if (fin === 'MAX_TOKENS') return { llm: null, fallo: 'La respuesta de Gemini quedó cortada (MAX_TOKENS)' };
  const llm = parsearJson(texto);
  if (!llm || typeof llm !== 'object' || !llm.clasificacion) {
    return { llm: null, fallo: 'Gemini no devolvió un JSON válido' + (fin && fin !== 'STOP' ? ' (' + fin + ')' : '') };
  }
  return { llm, fallo: null };
}

/** Motivos para repetir con el modelo preciso (vacío si la respuesta rápida es confiable). */
function motivosParaEscalar(resultado) {
  if (!resultado.llm) return [resultado.fallo];
  const ev = resultado.llm.evaluacion || {};
  const motivos = [];
  if (ev.legibilidad !== 'alta') motivos.push('legibilidad ' + (ev.legibilidad || 'sin evaluar'));
  if (ev.certeza_tipo !== 'alta') motivos.push('certeza del tipo ' + (ev.certeza_tipo || 'sin evaluar'));
  if (Array.isArray(ev.campos_dudosos) && ev.campos_dudosos.length) motivos.push('campos dudosos');
  if (ev.documentos_multiples === true) motivos.push('varios documentos en el archivo');
  return motivos;
}

// --- Ejecución en n8n --------------------------------------------------------

const prep = $('Preparar corrida').first().json;
const actual = interpretar($input.first().json);

if (ETAPA === 'rapida') {
  const motivos = prep.modelo_preciso && prep.modelo_preciso !== prep.modelo_rapido ? motivosParaEscalar(actual) : [];
  return [{
    json: {
      llm: actual.llm,
      fallo: actual.fallo,
      modelo: prep.modelo_rapido,
      escalar: motivos.length > 0,
      motivos_escalamiento: motivos,
    },
  }];
}

// Etapa precisa: se prefiere su respuesta; si falló, la del modelo rápido.
const rapida = $('Interpretar respuesta rápida').first().json;
const usarPrecisa = Boolean(actual.llm);
return [{
  json: {
    llm: usarPrecisa ? actual.llm : rapida.llm,
    fallo: usarPrecisa ? null : actual.fallo,
    modelo: usarPrecisa ? prep.modelo_preciso : rapida.modelo,
    escalado: true,
    motivos_escalamiento: rapida.motivos_escalamiento,
  },
}];
