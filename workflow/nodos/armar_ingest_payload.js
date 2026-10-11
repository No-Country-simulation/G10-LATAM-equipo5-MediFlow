// Nodo "Armar IngestPayload": construye el payload de POST /documents/ingest (contrato v2) con la
// respuesta final de la IA.
//
// Regla: nunca rellenar con valores inventados; un dato faltante va null. El backend normaliza
// (identificación, CIE-10, fechas), valida y calcula el puntaje de confianza con la `evaluacion`
// que hizo el LLM; aquí solo se asegura la forma de los datos y que tipo y cola existan.

const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const lista = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);

/** Código del catálogo: acepta el código o, por tolerancia, el nombre; si no existe, null. */
function codigoDeCatalogo(valor, catalogo) {
  const texto = String(valor || '').trim();
  const encontrado = catalogo.find((c) => c.codigo === texto) || catalogo.find((c) => c.nombre === texto);
  return encontrado ? encontrado.codigo : null;
}

function tipoArchivo(mime) {
  if (String(mime).includes('pdf')) return 'PDF';
  return String(mime).includes('png') ? 'PNG' : 'JPG';
}

function armarPayload({ resultado, prep, tipos, colas }) {
  const llm = obj(resultado.llm);
  const respuestaValida = Boolean(resultado.llm);
  const clasificacion = obj(llm.clasificacion);
  const decision = obj(llm.decision_enrutamiento);

  const tipo = codigoDeCatalogo(clasificacion.tipo_documento, tipos) || 'OTRO';
  let destino = codigoDeCatalogo(decision.destino_principal, colas);
  const destinoInvalido = !destino;
  if (destinoInvalido) destino = colas.some((c) => c.codigo === 'Ficha_Clinica') ? 'Ficha_Clinica' : (colas[0] || {}).codigo || 'Ficha_Clinica';

  const prioridad = ['Rutina', 'Prioritario', 'Urgente'].includes(clasificacion.nivel_prioridad)
    ? clasificacion.nivel_prioridad
    : 'Prioritario';

  const datos = obj(llm.datos_generales);
  const paciente = obj(datos.paciente);
  const evaluacion = {
    ...obj(llm.evaluacion),
    modelo: resultado.modelo || null,
    escalado: Boolean(resultado.escalado),
  };
  const notif = obj(decision.notificacion_generada);

  const justificacion = decision.justificacion_enrutamiento ||
    (respuestaValida ? null : resultado.fallo || 'La IA no devolvió un JSON válido');

  return {
    documento_id: String(prep.documento_id),
    archivos: [{ tipo_archivo: tipoArchivo(prep.archivo_mime), archivo_base64: String(prep.archivo_base64), rol: 'documento_principal' }],
    clasificacion: {
      tipo_documento: tipo,
      especialidad: clasificacion.especialidad || null,
      nivel_prioridad: prioridad,
      score_confianza_clasificacion: Number.isFinite(Number(clasificacion.score_confianza_clasificacion))
        ? Math.min(1, Math.max(0, Number(clasificacion.score_confianza_clasificacion)))
        : null,
    },
    // Sin respuesta válida no hay autoevaluación: el backend la toma como de certeza baja.
    evaluacion: respuestaValida ? evaluacion : { legibilidad: 'baja', certeza_tipo: 'baja', modelo: evaluacion.modelo, escalado: evaluacion.escalado },
    datos_generales: {
      paciente: {
        nombre: paciente.nombre || null,
        identificacion: paciente.identificacion && typeof paciente.identificacion === 'object' ? paciente.identificacion : null,
        edad: paciente.edad ?? null,
        fecha_nacimiento: paciente.fecha_nacimiento || null,
        sexo: paciente.sexo || null,
        numero_ficha: paciente.numero_ficha || null,
      },
      profesionales: lista(datos.profesionales),
      institucion_emisora: datos.institucion_emisora || null,
      fecha_documento: datos.fecha_documento || null,
      diagnosticos: lista(datos.diagnosticos),
    },
    detalle_clinico: Object.fromEntries(
      Object.entries(obj(llm.detalle_clinico)).filter(([, valor]) => valor && typeof valor === 'object')
    ),
    decision_enrutamiento: {
      destino_principal: destino,
      requiere_auditoria_humana: Boolean(!respuestaValida || decision.requiere_auditoria_humana || tipo === 'OTRO' || destinoInvalido),
      justificacion_enrutamiento: justificacion ? String(justificacion).slice(0, 500) : null,
      notificacion_generada: notif.canal && notif.mensaje ? { canal: String(notif.canal), mensaje: String(notif.mensaje) } : null,
    },
  };
}

// --- Ejecución en n8n --------------------------------------------------------

function listaDe(nombreNodo) {
  const items = $(nombreNodo).all();
  if (items.length === 1 && Array.isArray(items[0].json)) return items[0].json;
  return items.map((i) => i.json);
}

const prep = $('Preparar corrida').first().json;
if (!prep.archivo_base64) {
  throw new Error('No hay archivo en base64 desde Preparar corrida');
}

return [{
  json: armarPayload({
    resultado: $input.first().json,
    prep,
    tipos: ($('GET formularios').first().json.tipos || []),
    colas: listaDe('GET colas activas'),
  }),
}];
