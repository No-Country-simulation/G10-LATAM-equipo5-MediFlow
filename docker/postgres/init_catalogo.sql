-- Catálogo semilla: tipos de documento y colas de enrutamiento.
--
-- n8n los lee (GET /api/v1/catalogs/document-types/active y /queues/active) para armar el prompt:
-- el `codigo` es exactamente lo que el LLM debe devolver y la `descripcion` es lo que lee para
-- decidir. Por eso cada descripción dice cuándo SÍ y cuándo NO usar la opción, e incluye los
-- títulos con que el documento aparece en distintos países.
--
-- Se ejecuta después de init.sql (orden alfabético). Es re-ejecutable: inserta lo que falta y
-- ACTUALIZA nombre, descripción y campos de los registros semilla (si un ADMIN los editó desde el
-- mantenedor, re-ejecutar este archivo restaura el texto semilla). No toca `is_active` ni los
-- registros creados desde el mantenedor.
--
-- Los tipos sin bloque propio en el backend (SOLICITUD_EXAMENES, ATENCION_URGENCIA,
-- CERTIFICADO_MEDICO) definen sus campos en `campos_extraccion` (JSON Schema): el LLM los llena en
-- `detalle_clinico.campos_adicionales` y el formulario de auditoría los muestra. Los campos son
-- nullable (`["string", "null"]`): un dato ausente no es un error del documento.

INSERT INTO document_types (codigo, nombre, descripcion, campos_extraccion) VALUES
(
    'RECETA',
    'Receta Médica',
    'Prescripción de medicamentos para que el paciente los adquiera o use: nombre, dosis, frecuencia y duración. Títulos: Receta médica, Receta, Prescripción, Rp. con medicamentos; receta retenida o de controlados (psicotrópicos, estupefacientes). El talonario "Rp." NO basta: si lista exámenes es SOLICITUD_EXAMENES y si deriva a otro profesional es INTERCONSULTA. NO incluye las indicaciones dentro de una epicrisis, atención o urgencia (esos medicamentos se extraen en su propio tipo).',
    NULL
),
(
    'LABORATORIO',
    'Informe de Laboratorio',
    'Informe de RESULTADOS de análisis de muestras (sangre, orina, deposiciones, cultivos, gases) con parámetros, valores, unidades y rangos de referencia; suele traer N° de petición u orden y la validación de un tecnólogo o bioquímico. Títulos: Informe de resultados, Resultados de laboratorio, Exámenes de laboratorio, Hemograma, Perfil bioquímico. NO es una orden de exámenes sin valores (SOLICITUD_EXAMENES) ni una biopsia o citología (ANATOMIA_PATOLOGICA).',
    NULL
),
(
    'IMAGENES',
    'Informe de Estudio por Imágenes',
    'Informe de un estudio de imagen YA realizado, redactado por un radiólogo o médico informante: técnica, hallazgos e impresión o conclusión. Radiografía (Rx), tomografía (TC, TAC), resonancia (RM), ecografía o ecotomografía, mamografía, densitometría, PET, medicina nuclear. NO es la orden del estudio (SOLICITUD_EXAMENES).',
    NULL
),
(
    'SOLICITUD_EXAMENES',
    'Solicitud de Exámenes',
    'Orden médica que PIDE exámenes o estudios aún no realizados: laboratorio, imagenología u otros exámenes diagnósticos, con o sin código de prestación (ej. FONASA 0301045). Títulos: Solicitud de exámenes, Orden de exámenes, Orden médica, Petición de estudios; también recetarios "Rp." que listan exámenes (ej. "Rx de tórax", "hemograma"). NO trae resultados (LABORATORIO o IMAGENES). Cirugías o procedimientos invasivos: SOLICITUD_PROCEDIMIENTO.',
    '{"type": "object", "properties": {"indicacion_clinica": {"type": ["string", "null"], "title": "Indicación clínica / diagnóstico", "maxLength": 500}, "prioridad_solicitada": {"type": ["string", "null"], "title": "Prioridad indicada (urgente, control, ...)", "maxLength": 100}}, "propertyOrdering": ["indicacion_clinica", "prioridad_solicitada"]}'::jsonb
),
(
    'SOLICITUD_PROCEDIMIENTO',
    'Solicitud de Procedimiento',
    'Solicitud o indicación de un procedimiento invasivo o quirúrgico aún no realizado que debe agendarse: cirugía, endoscopía, colonoscopía, biopsia, cateterismo, punción. Títulos: Solicitud de pabellón, Orden de cirugía, Solicitud de procedimiento. NO incluye exámenes de laboratorio o imagen (SOLICITUD_EXAMENES) ni derivaciones a un especialista (INTERCONSULTA).',
    NULL
),
(
    'EPICRISIS',
    'Epicrisis / Informe de Alta',
    'Resumen de una HOSPITALIZACIÓN al alta: fechas de ingreso y egreso, diagnósticos de ingreso y egreso, evolución, procedimientos, condición e indicaciones al alta. Títulos: Epicrisis, Informe de alta, Resumen de egreso, Alta hospitalaria. NO es una atención de urgencia sin hospitalización (ATENCION_URGENCIA).',
    NULL
),
(
    'INTERCONSULTA',
    'Interconsulta / Derivación',
    'Solicitud de evaluación por otra especialidad, profesional o centro (derivación, referencia) con su motivo y antecedentes; incluye órdenes de evaluación por kinesiología, psicología, nutrición o fonoaudiología. Títulos: Interconsulta, Derivación, Referencia, Hoja de referencia y contrarreferencia, SIC.',
    NULL
),
(
    'ANATOMIA_PATOLOGICA',
    'Informe de Anatomía Patológica',
    'Resultado del análisis de tejidos o células: biopsia, pieza quirúrgica, citología, PAP, inmunohistoquímica; con descripción macro y microscópica y diagnóstico histopatológico. Suele indicar si hay o no malignidad.',
    NULL
),
(
    'PROTOCOLO_OPERATORIO',
    'Protocolo Operatorio',
    'Informe de una cirugía YA realizada: equipo quirúrgico, técnica, hallazgos intraoperatorios, complicaciones y muestras enviadas a estudio. Títulos: Protocolo operatorio, Hoja o nota quirúrgica, Informe quirúrgico.',
    NULL
),
(
    'NOTA_ATENCION',
    'Nota de Atención Ambulatoria',
    'Registro de una atención o evaluación ambulatoria: consulta, control, telemedicina, o evaluación y plan de tratamiento de kinesiología, rehabilitación o psicología; con motivo, anamnesis, examen físico, diagnóstico e indicaciones o plan. Títulos: Atención ambulatoria, Resumen de atención, Nota de consulta, Evolución, Plan de tratamiento. NO es una hospitalización (EPICRISIS), una urgencia (ATENCION_URGENCIA) ni un certificado para terceros (CERTIFICADO_MEDICO).',
    NULL
),
(
    'ATENCION_URGENCIA',
    'Atención de Urgencia / Prehospitalaria',
    'Registro de una atención de urgencia o prehospitalaria: dato o documento de atención de urgencia (DAU), hoja de ingreso a urgencias, hoja de intervención SAMU o ambulancia. Suele traer categoría o color de triaje (C1-C5, ESI, Manchester: rojo, naranjo, amarillo, verde, azul), signos vitales, tratamiento administrado, diagnóstico presuntivo y final, y destino (alta, hospitalización, traslado). NO es la epicrisis de una hospitalización (EPICRISIS).',
    '{"type": "object", "properties": {"categoria_triaje": {"type": ["string", "null"], "title": "Categoría o color de triaje", "maxLength": 50}, "motivo_consulta": {"type": ["string", "null"], "title": "Motivo de consulta", "maxLength": 1000}, "signos_vitales": {"type": ["object", "null"], "title": "Signos vitales", "properties": {"presion_arterial": {"type": ["string", "null"], "title": "Presión arterial", "maxLength": 20}, "frecuencia_cardiaca": {"type": ["string", "null"], "title": "Frecuencia cardíaca", "maxLength": 20}, "frecuencia_respiratoria": {"type": ["string", "null"], "title": "Frecuencia respiratoria", "maxLength": 20}, "saturacion_o2": {"type": ["string", "null"], "title": "Saturación O2", "maxLength": 20}, "temperatura": {"type": ["string", "null"], "title": "Temperatura", "maxLength": 20}, "glasgow": {"type": ["string", "null"], "title": "Glasgow", "maxLength": 20}, "glicemia": {"type": ["string", "null"], "title": "Glicemia / HGT", "maxLength": 20}}, "propertyOrdering": ["presion_arterial", "frecuencia_cardiaca", "frecuencia_respiratoria", "saturacion_o2", "temperatura", "glasgow", "glicemia"]}, "examen_fisico": {"type": ["string", "null"], "title": "Examen físico", "maxLength": 2000}, "tratamiento_realizado": {"type": ["string", "null"], "title": "Tratamiento y procedimientos realizados", "maxLength": 2000}, "destino": {"type": ["string", "null"], "title": "Destino del paciente", "enum": ["ALTA", "HOSPITALIZACION", "TRASLADO", "FALLECIDO", "OTRO", null]}}, "propertyOrdering": ["categoria_triaje", "motivo_consulta", "signos_vitales", "examen_fisico", "tratamiento_realizado", "destino"]}'::jsonb
),
(
    'CERTIFICADO_MEDICO',
    'Certificado / Licencia Médica',
    'Documento que certifica o informa a un TERCERO (empleador, colegio, seguro, tribunal): certificado de atención, de reposo, de salud o aptitud, licencia médica o incapacidad, informe médico para un trámite. Títulos: Certificado médico, Licencia médica, Constancia, Informe médico. NO es el registro clínico de la consulta (NOTA_ATENCION).',
    '{"type": "object", "properties": {"tipo_certificado": {"type": ["string", "null"], "title": "Tipo de certificado", "enum": ["ATENCION", "REPOSO", "LICENCIA_MEDICA", "APTITUD", "INFORME_MEDICO", "OTRO", null]}, "motivo": {"type": ["string", "null"], "title": "Motivo / contenido certificado", "maxLength": 1000}, "reposo_desde": {"type": ["string", "null"], "title": "Reposo desde", "format": "date"}, "reposo_hasta": {"type": ["string", "null"], "title": "Reposo hasta", "format": "date"}, "dias_reposo": {"type": ["integer", "null"], "title": "Días de reposo", "minimum": 0}, "destinatario": {"type": ["string", "null"], "title": "Para presentar en", "maxLength": 200}}, "propertyOrdering": ["tipo_certificado", "motivo", "reposo_desde", "reposo_hasta", "dias_reposo", "destinatario"]}'::jsonb
),
(
    'OTRO',
    'Otro / No clasificable',
    'Usar cuando el documento no es clínico o no corresponde claramente a ningún otro tipo (consentimientos, documentos administrativos, facturas) o es ilegible. Siempre requiere auditoría humana.',
    NULL
)
ON CONFLICT (codigo) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    campos_extraccion = EXCLUDED.campos_extraccion;

-- `es_asistencial` (aparece en la Consola de Triaje) solo se fija al crear la cola: el ON CONFLICT no lo
-- pisa, para respetar lo que el administrador cambie desde el mantenedor.
INSERT INTO routing_queues (codigo, nombre, descripcion_semantica, notificar_inmediato, es_asistencial) VALUES
(
    'Cola_Emergencia_Medica',
    'Urgencias',
    'Usar SOLO si el documento muestra riesgo vital o un valor crítico que requiere acción en minutos u horas: hallazgo como tromboembolismo pulmonar, neumotórax, infarto o hemorragia activa; valor de laboratorio marcado como crítico o de pánico (ej. potasio > 6.5 mEq/L, hemoglobina < 7 g/dL); triaje rojo o naranjo (C1-C2). Aplica a cualquier tipo de documento. NO usar para resultados alterados sin riesgo inmediato ni para urgencia meramente administrativa.',
    TRUE,
    TRUE
),
(
    'Farmacia_Hospitalaria',
    'Farmacia Hospitalaria',
    'Recetas médicas que requieren validación farmacéutica o dispensación, con prioridad para medicamentos controlados, de alto costo o con posibles interacciones. NO usar si la receta contiene además un hallazgo crítico (ver Urgencias).',
    FALSE,
    FALSE
),
(
    'Gestion_Procedimientos',
    'Procedimientos y Exámenes',
    'Órdenes que deben agendarse: solicitudes de exámenes de laboratorio o imagenología y de procedimientos o cirugías pendientes (endoscopía, biopsia, procedimiento invasivo). NO usar para exámenes o procedimientos ya realizados (ver Ficha Clínica).',
    FALSE,
    TRUE
),
(
    'Gestion_Interconsultas',
    'Interconsultas y Derivaciones',
    'Interconsultas o derivaciones a otra especialidad, profesional (kinesiología, psicología, nutrición), centro o nivel de atención que deben gestionarse e ingresar a lista de espera o agenda.',
    FALSE,
    TRUE
),
(
    'Cola_Oncologia',
    'Oncología',
    'Documentos con sospecha o confirmación de malignidad (ej. biopsia positiva para carcinoma, imagen sugerente de neoplasia, masa tumoral, metástasis) que requieren ingreso oportuno a la ruta de atención oncológica. Si además hay riesgo vital inmediato, usar Urgencias.',
    TRUE,
    TRUE
),
(
    'Ficha_Clinica',
    'Ficha Clínica',
    'Destino por defecto: documentos informativos que solo deben incorporarse a la historia clínica del paciente, sin acción pendiente: resultados normales o alterados sin riesgo inmediato, epicrisis, protocolos operatorios, atenciones e informes de control, certificados y licencias médicas.',
    FALSE,
    FALSE
)
ON CONFLICT (codigo) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    descripcion_semantica = EXCLUDED.descripcion_semantica,
    notificar_inmediato = EXCLUDED.notificar_inmediato;

-- Registros de sistema: OTRO es el comodín de la IA y Ficha_Clinica el destino por defecto.
UPDATE document_types SET es_sistema = TRUE WHERE codigo = 'OTRO';
-- Ficha_Clinica la ven todos los usuarios: no es asistencial (no va a Triaje) ni se asigna a nadie.
UPDATE routing_queues SET es_sistema = TRUE, es_asistencial = FALSE WHERE codigo = 'Ficha_Clinica';
DELETE FROM user_queues
WHERE queue_id IN (SELECT id FROM routing_queues WHERE codigo = 'Ficha_Clinica');
