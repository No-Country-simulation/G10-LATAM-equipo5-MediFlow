// Nodo "Contexto para IA": arma el prompt y la petición a Gemini con el archivo adjunto.
//
// El archivo (PDF, PNG o JPG) se envía TAL CUAL a Gemini, que lee PDF nativo (texto, tablas y
// escaneos) e imágenes: no hay extracción de texto previa, que desordenaba las tablas de
// laboratorio y no servía para escaneos.
//
// Todo lo que entra al prompt se paga en cada documento: instrucciones fijas primero, luego los
// catálogos (cambian poco) y el archivo al final, para aprovechar la caché implícita de Gemini.
// Los campos de cada tipo salen de GET /catalogs/document-types/forms: la misma fuente que usa el
// formulario de auditoría del backend.

const MAX_OUTPUT_TOKENS = 16384;

/** Tipo principal de un JSON Schema (`["string", "null"]` -> `string`). */
function tipoDe(esquema) {
  const tipo = esquema && esquema.type;
  return Array.isArray(tipo) ? tipo.find((t) => t !== 'null') : tipo;
}

/** Descripción compacta de los campos de un esquema: `{campo,otro:(A|B),lista:[{...}]}`. */
function describirCampos(esquema) {
  if (!esquema) return '';
  const tipo = tipoDe(esquema);
  if (tipo === 'array') return '[' + describirCampos(esquema.items) + ']';
  if (tipo !== 'object') return '';
  const campos = Object.entries(esquema.properties || {}).map(([nombre, definicion]) => {
    const tipoCampo = tipoDe(definicion);
    if (tipoCampo === 'object' || tipoCampo === 'array') return nombre + ':' + describirCampos(definicion);
    if (Array.isArray(definicion.enum)) {
      return nombre + ':(' + definicion.enum.filter((v) => v !== null).join('|') + ')';
    }
    if (definicion.format === 'date') return nombre + ':fecha';
    if (tipoCampo === 'boolean') return nombre + ':bool';
    if (tipoCampo === 'integer' || tipoCampo === 'number') return nombre + ':num';
    return nombre;
  });
  return '{' + campos.join(',') + '}';
}

function lineaTipo(tipo) {
  let linea = '- ' + tipo.codigo + ' (' + tipo.nombre + '): ' + tipo.descripcion;
  if (tipo.bloque) linea += '\n  bloque ' + tipo.bloque + ':' + describirCampos(tipo.esquema);
  return linea;
}

function lineaCola(cola) {
  return '- ' + cola.codigo + ' (' + cola.nombre + ')' + (cola.notificar_inmediato ? ' [NOTIFICAR]' : '') +
    ': ' + cola.descripcion_semantica;
}

const INSTRUCCIONES = `Eres MediFlow-AI, motor de triaje y extracción de documentos clínicos de cualquier país de habla hispana o portuguesa. Lee el archivo adjunto completo (todas sus páginas) y responde SOLO un objeto JSON válido con la estructura de SALIDA.

1. CLASIFICACIÓN (decide en este orden)
- ¿Es un documento clínico? Si no, tipo OTRO y es_documento_clinico=false.
- Decide por el CONTENIDO y el título, no por el formulario impreso: un talonario "Rp." puede ser una receta, una orden de exámenes o una derivación.
- ¿Trae RESULTADOS (valores, hallazgos, informe de un estudio hecho)? -> LABORATORIO, IMAGENES o ANATOMIA_PATOLOGICA.
- ¿PIDE algo que aún no se hace? Exámenes -> SOLICITUD_EXAMENES; cirugía o procedimiento invasivo -> SOLICITUD_PROCEDIMIENTO; evaluación por otro profesional o centro -> INTERCONSULTA.
- ¿Prescribe medicamentos para que el paciente los adquiera? -> RECETA.
- ¿Registra una atención? Urgencia o ambulancia -> ATENCION_URGENCIA; hospitalización al alta -> EPICRISIS; consulta o evaluación ambulatoria -> NOTA_ATENCION; cirugía realizada -> PROTOCOLO_OPERATORIO.
- ¿Certifica algo ante un tercero (reposo, licencia, asistencia)? -> CERTIFICADO_MEDICO.
- tipo_documento y destino_principal: EXACTAMENTE un "codigo" de TIPOS y de COLAS.

2. DATOS DEL PACIENTE
- nombre: tal como aparece, sin reordenar; si aparece escrito de dos formas, usa la más completa.
- identificacion: el documento de identidad del PACIENTE (nunca el de un profesional). tipo: RUT (Chile: "RUT", "RUN", "Número de documento" con formato 12.345.678-9), DNI (Argentina, Perú, España), CURP (México, 18 caracteres), CEDULA ("C.I.", "C.C.", "Cédula" de otros países), CPF (Brasil), PASAPORTE u OTRO. numero: cópialo tal cual. pais: código ISO de 2 letras si se deduce (institución, dirección, formato); si no, null.
- numero_ficha: "Ficha", "N° de ficha", "Historia clínica", "HC", "N° de historia", "Expediente", "MRN". NO es ficha el número del informe, petición, orden, folio o consecutivo.
- edad en años (entero); fecha_nacimiento; sexo F, M o X.

3. DEMÁS DATOS
- Fechas en formato AAAA-MM-DD; interpreta dd/mm/aaaa. Si el año tiene 2 dígitos o la fecha es ambigua: null y agrégala a campos_dudosos.
- fecha_documento: la del examen en un informe, la de la atención en una atención o urgencia, la de alta en una epicrisis, la de emisión en recetas, órdenes y certificados.
- institucion_emisora: hospital, clínica, laboratorio o centro que emite el documento.
- profesionales: cada uno con su rol. INFORMANTE: radiólogo, patólogo o quien valida un laboratorio; quien firma una epicrisis o certificado. SOLICITANTE: quien pide el examen, la orden o la interconsulta ("Referido por"). TRATANTE: quien atiende la consulta o la urgencia. DESTINATARIO: a quien se deriva. identificacion: RUT o cédula del profesional; registro_profesional: matrícula, registro, colegiatura o cédula profesional.
- "NO DISPONIBLE", "NO APLICA", "S/I", guiones o campos de plantilla vacíos: null. No inventes datos; lo que falta va null.
- Copia los textos literalmente. Si el mismo texto se repite en varias secciones (fichas electrónicas), inclúyelo solo en la sección que corresponde.
- Si el archivo trae más de un documento, extrae solo el principal y marca documentos_multiples=true.

4. DIAGNÓSTICOS Y CIE-10
- diagnosticos: todos los diagnósticos explícitos; uno solo con tipo PRINCIPAL (impresión o conclusión de un informe, diagnóstico de egreso de una epicrisis, diagnóstico final de una urgencia o, si no hay, el presuntivo). certeza: CONFIRMADO o PRESUNTIVO (sospecha, hipótesis, "a descartar", "en estudio").
- Si el documento trae el código CIE-10 impreso, cópialo con origen_cie10 DOCUMENTO.
- Si no, asigna el código CIE-10 (OMS) más específico que respalde el diagnóstico escrito, con 4 caracteres cuando el texto lo permita (ej. J45.9, M50.0, C34.9, K76.0), y origen_cie10 INFERIDO. Ante una sospecha sin confirmar, codifica lo sospechado o el síntoma (capítulo R).
- Estudio sin hallazgos patológicos: descripcion "Sin hallazgos patológicos" y cie10 null. Nunca uses CIE-9, CIE-11 ni SNOMED; sin diagnóstico explícito, cie10 null.

5. CONTENIDO CLÍNICO (detalle_clinico)
- Usa SOLO el bloque del tipo elegido (tipo sin bloque: ninguno) más las listas comunes:
  medicamentos:[{nombre,dosis,frecuencia,via,duracion_tratamiento,cantidad,tipo:(PRESCRITO|ADMINISTRADO)}] de cualquier tipo de documento (receta, indicaciones de alta o de una atención; ADMINISTRADO si se aplicó en urgencias o ambulancia).
  examenes_solicitados:[{codigo,nombre,categoria:(LABORATORIO|IMAGENOLOGIA|PROCEDIMIENTO|OTRO)}] cuando el documento pide exámenes (codigo: código de prestación si aparece).
- Si el bloque del tipo es campos_adicionales, usa exactamente esos campos.
- Laboratorio: un parámetro por fila, con el valor, la unidad y el rango de la MISMA fila; agrúpalos por panel o sección e indica la muestra (sangre, orina). alterado=true si está marcado (*, H, L, flechas, negrita) o fuera del rango. critico=true SOLO si el informe lo marca como valor crítico o de pánico (ej. "**"). Omite tablas de interpretación y notas de metodología.

6. PRIORIDAD Y DESTINO
- Urgente: riesgo vital, valor crítico, triaje rojo o naranjo (C1-C2, ESI 1-2) o hallazgo agudo grave (TEP, neumotórax, hemorragia, masa con compromiso de estructuras vitales).
- Prioritario: requiere acción en días: sospecha o confirmación de malignidad, fractura, resultados alterados relevantes, triaje amarillo (C3).
- Rutina: normal, controles, enfermedad crónica estable, certificados, triaje verde o azul.
- Cola [NOTIFICAR]: notificacion_generada={canal,mensaje (máx. 120 caracteres)}; si no, null. justificacion_enrutamiento: máx. 200 caracteres.

7. AUTOEVALUACIÓN (evaluacion), sé honesto
- legibilidad: alta (todo lo relevante se lee sin dudas), media (algunas palabras o valores inciertos: manuscrito, escaneo regular), baja (gran parte ilegible).
- certeza_tipo: alta (título o estructura inequívocos), media (rasgos de dos tipos), baja (no calza bien con ninguno).
- evidencia_tipo: cita literal breve del título o encabezado que justifica el tipo.
- campos_dudosos: rutas de los campos cuya lectura no es segura (ej. "paciente.identificacion.numero", "medicamentos[0].dosis").
- requiere_auditoria_humana=true si dudas de algún dato clave.

SALIDA
{"clasificacion":{"tipo_documento":"","especialidad":null,"nivel_prioridad":"Rutina|Prioritario|Urgente"},"evaluacion":{"legibilidad":"alta|media|baja","certeza_tipo":"alta|media|baja","evidencia_tipo":null,"campos_dudosos":[],"documentos_multiples":false,"es_documento_clinico":true},"datos_generales":{"paciente":{"nombre":null,"identificacion":{"tipo":null,"numero":null,"pais":null},"edad":null,"fecha_nacimiento":null,"sexo":null,"numero_ficha":null},"profesionales":[{"nombre":"","identificacion":null,"registro_profesional":null,"especialidad":null,"rol":""}],"institucion_emisora":null,"fecha_documento":null,"diagnosticos":[{"descripcion":"","cie10":null,"tipo":"PRINCIPAL|SECUNDARIO","certeza":"CONFIRMADO|PRESUNTIVO","origen_cie10":"DOCUMENTO|INFERIDO"}]},"detalle_clinico":{},"decision_enrutamiento":{"destino_principal":"","requiere_auditoria_humana":false,"justificacion_enrutamiento":"","notificacion_generada":null}}`;

function armarPrompt(formularios, colas) {
  const tipos = (formularios && formularios.tipos) || [];
  return INSTRUCCIONES +
    '\n\nTIPOS\n' + (tipos.map(lineaTipo).join('\n') || '(vacío: usa OTRO y requiere_auditoria_humana=true)') +
    '\n\nCOLAS\n' + ((colas || []).map(lineaCola).join('\n') || '(vacío: requiere_auditoria_humana=true)') +
    '\n\nDOCUMENTO: ver archivo adjunto.';
}

function armarPeticionGemini(prompt, mime, base64) {
  return {
    contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: base64 } }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', maxOutputTokens: MAX_OUTPUT_TOKENS },
  };
}

// --- Ejecución en n8n --------------------------------------------------------

function listaDe(nombreNodo) {
  const items = $(nombreNodo).all();
  if (items.length === 1 && Array.isArray(items[0].json)) return items[0].json;
  return items.map((i) => i.json);
}

const prep = $('Preparar corrida').first().json;
const prompt = armarPrompt($('GET formularios').first().json, listaDe('GET colas activas'));

return [{
  json: {
    gemini_request: armarPeticionGemini(prompt, prep.archivo_mime, prep.archivo_base64),
    largo_prompt: prompt.length,
  },
}];
