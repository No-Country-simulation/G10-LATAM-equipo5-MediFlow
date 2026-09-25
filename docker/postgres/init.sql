-- Habilitar extensión para UUIDs criptográficos
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de Usuarios / Auditores
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(30) DEFAULT 'AUDITOR_CLINICO' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. Tabla de Documentos Clínicos y Triaje
CREATE TABLE IF NOT EXISTS clinical_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    documento_id VARCHAR(64) UNIQUE NOT NULL,
    estado VARCHAR(30) NOT NULL,
    
    -- Datos del Paciente (Indexados)
    rut_paciente VARCHAR(20),
    nombre_paciente VARCHAR(150),
    edad_paciente INTEGER,
    
    -- Datos del Profesional
    medico_nombre VARCHAR(150),
    medico_rut VARCHAR(20),
    
    -- Clasificación y Triaje Clínico
    tipo_documento VARCHAR(80) NOT NULL,
    especialidad VARCHAR(100),
    nivel_prioridad VARCHAR(20) NOT NULL,
    score_confianza NUMERIC(4, 3) NOT NULL,
    requiere_auditoria BOOLEAN DEFAULT FALSE NOT NULL,
    
    -- Diagnóstico y Derivación
    diagnostico_principal TEXT,
    cie10_sugerido VARCHAR(10),
    destino_enrutamiento VARCHAR(80),
    justificacion_enrutamiento TEXT,
    
    -- Trazabilidad OCI Storage
    oci_bucket_name VARCHAR(100) NOT NULL,
    oci_json_path VARCHAR(255) NOT NULL,

    -- Carga Completa del LLM (Respaldo íntegro: incluye texto libre de imagenología,
    -- evolución de epicrisis, etc. que no tiene columna ni tabla relacional propia)
    raw_extracted_json JSONB NOT NULL,

    -- Control Human-in-the-Loop
    audited_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    audit_notes TEXT,
    audited_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2.1 Archivos binarios del documento (un documento puede traer más de uno: varias placas
-- de una orden de Rx, o múltiples capturas de una ecotomografía más su informe)
CREATE TABLE IF NOT EXISTS clinical_document_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES clinical_documents(id) ON DELETE CASCADE,
    rol VARCHAR(50),
    tipo_archivo VARCHAR(20) NOT NULL,
    oci_path VARCHAR(255) NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_document_attachments_document_id
ON clinical_document_attachments(document_id);

-- 2.2 Medicamentos de una Receta (detalle_clinico.medicamentos)
CREATE TABLE IF NOT EXISTS clinical_document_medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES clinical_documents(id) ON DELETE CASCADE,
    nombre VARCHAR(200) NOT NULL,
    dosis VARCHAR(100),
    duracion_tratamiento VARCHAR(100),
    orden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_document_medications_document_id
ON clinical_document_medications(document_id);

-- 2.3 Paneles y parámetros de un Informe de Laboratorio (detalle_clinico.examenes_y_laboratorio)
CREATE TABLE IF NOT EXISTS lab_panels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES clinical_documents(id) ON DELETE CASCADE,
    nombre_panel VARCHAR(150) NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_lab_panels_document_id ON lab_panels(document_id);

CREATE TABLE IF NOT EXISTS lab_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    panel_id UUID NOT NULL REFERENCES lab_panels(id) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    valor VARCHAR(50),
    unidad VARCHAR(30),
    rango_referencia VARCHAR(50),
    alterado BOOLEAN,
    orden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_lab_parameters_panel_id ON lab_parameters(panel_id);
-- Índice parcial para responder rápido "qué documentos tienen un parámetro alterado".
CREATE INDEX IF NOT EXISTS idx_lab_parameters_alterado ON lab_parameters(nombre)
WHERE alterado = TRUE;

-- 2.4 Procedimientos realizados durante una internación (detalle_clinico.procedimientos_e_internacion)
CREATE TABLE IF NOT EXISTS clinical_document_procedures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES clinical_documents(id) ON DELETE CASCADE,
    descripcion TEXT NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_document_procedures_document_id
ON clinical_document_procedures(document_id);

-- Tokens JWT invalidados por logout
CREATE TABLE IF NOT EXISTS revoked_tokens (
    jti VARCHAR(64) PRIMARY KEY,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires_at ON revoked_tokens(expires_at);

-- Catálogos: colas de enrutamiento (su descripción semántica se inyecta en el prompt de n8n)
CREATE TABLE IF NOT EXISTS routing_queues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(80) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion_semantica TEXT NOT NULL,
    notificar_inmediato BOOLEAN DEFAULT FALSE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Catálogos: tipos de documento clínico admitidos
CREATE TABLE IF NOT EXISTS document_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(80) NOT NULL,
    descripcion TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. Índices de Alto Rendimiento
-- Acelera el conteo del Smart Delete de colas (destino_enrutamiento = routing_queues.codigo)
CREATE INDEX IF NOT EXISTS idx_clinical_docs_destino ON clinical_documents(destino_enrutamiento);
CREATE INDEX IF NOT EXISTS idx_clinical_docs_rut ON clinical_documents(rut_paciente);
CREATE INDEX IF NOT EXISTS idx_clinical_docs_estado ON clinical_documents(estado);
CREATE INDEX IF NOT EXISTS idx_clinical_docs_pendiente_auditoria 
ON clinical_documents(created_at DESC) 
WHERE estado = 'PENDIENTE_AUDITORIA';

-- 4. Usuarios semilla para pruebas, uno por rol (SOLO desarrollo: cambiar antes de desplegar)
-- Contraseñas: admin_user / admin123, gestor_user / gestor123, auditor_user / auditor123
-- (se guardan como hash bcrypt)
INSERT INTO users (username, email, hashed_password, full_name, role) VALUES
(
    'admin_user',
    'administrador@mediflow.cl',
    '$2b$12$5ga92VwMZ957OBX9lcuZ6.yl2OQ5LZl5eeMMMNJ8JUT.Eg1JoFzdW',
    'Administrador MediFlow',
    'ADMIN'
),
(
    'gestor_user',
    'gestor.usuarios@mediflow.cl',
    '$2b$12$3i5NK.X9koqnkL5OtOp/.eY44.Q2a/GUs/XQ.GoNAaA7x9vK3IVwe',
    'Gestor de Usuarios MediFlow',
    'GESTOR_USUARIOS'
),
(
    'auditor_user',
    'auditor.clinico@mediflow.cl',
    '$2b$12$WaGpjNNMefR30Icr2MBKZOuLzlK.0UamsmizM4GnUJUwd4czYdoFm',
    'Auditor Clínico MediFlow',
    'AUDITOR_CLINICO'
)
ON CONFLICT (username) DO NOTHING;
-- 5. Maestras semilla. n8n las lee vía GET /api/v1/catalogs/document-types/active y
-- GET /api/v1/catalogs/queues/active para armar el prompt,
-- por lo que `nombre` (tipos) y `codigo` (colas) son exactamente lo que el LLM debe devolver.
-- Las descripciones las lee el LLM: dicen cuándo SÍ y cuándo NO usar cada opción.
INSERT INTO document_types (codigo, nombre, descripcion) VALUES
(
    'RECETA',
    'Receta Médica',
    'Prescripción de medicamentos con nombre, dosis, frecuencia y duración del tratamiento. Incluye recetas de medicamentos controlados (psicotrópicos, estupefacientes). NO incluye indicaciones al alta dentro de una epicrisis.'
),
(
    'LABORATORIO',
    'Informe de Laboratorio',
    'Resultados de análisis de muestras biológicas con parámetros, valores, unidades y rangos de referencia: hemograma, bioquímica, coagulación, orina, cultivos, gases. NO incluye biopsias ni citologías (ver Anatomía Patológica).'
),
(
    'IMAGENES',
    'Informe de Estudio por Imágenes',
    'Informe de un estudio de imagenología con técnica, hallazgos y conclusión del radiólogo: radiografía, tomografía, resonancia, ecografía, mamografía, medicina nuclear.'
),
(
    'SOLICITUD_PROCEDIMIENTO',
    'Solicitud de Procedimiento',
    'Orden o solicitud de un procedimiento aún no realizado: cirugía, endoscopía, biopsia, cateterismo u otro examen invasivo que debe agendarse. NO incluye derivaciones a otra especialidad (ver Interconsulta).'
),
(
    'EPICRISIS',
    'Epicrisis / Informe de Alta',
    'Resumen de una hospitalización al momento del alta: motivo de ingreso, evolución, procedimientos realizados, diagnósticos de egreso e indicaciones al alta.'
),
(
    'INTERCONSULTA',
    'Interconsulta / Derivación',
    'Solicitud de evaluación por otra especialidad o de derivación a otro centro o nivel de atención, con motivo de la consulta y antecedentes clínicos.'
),
(
    'ANATOMIA_PATOLOGICA',
    'Informe de Anatomía Patológica',
    'Resultado del análisis de tejidos o células: biopsias, piezas quirúrgicas, citologías, PAP. Suele indicar si hay o no malignidad.'
),
(
    'PROTOCOLO_OPERATORIO',
    'Protocolo Operatorio',
    'Informe del equipo quirúrgico sobre un procedimiento YA realizado: técnica, hallazgos intraoperatorios, complicaciones y muestras enviadas a estudio.'
),
(
    'OTRO',
    'Otro / No clasificable',
    'Usar cuando el documento no corresponde claramente a ninguno de los otros tipos (consentimientos, certificados, documentos administrativos) o es ilegible. Siempre requiere auditoría humana.'
)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO routing_queues (codigo, nombre, descripcion_semantica, notificar_inmediato) VALUES
(
    'Cola_Emergencia_Medica',
    'Urgencias',
    'Usar SOLO si el documento contiene un hallazgo que amenaza la vida o un valor crítico que requiere acción en minutos u horas (ej. tromboembolismo pulmonar, neumotórax, infarto, hemorragia activa, potasio > 6.5 mEq/L, hemoglobina < 7 g/dL). Aplica a cualquier tipo de documento. NO usar para resultados alterados sin riesgo inmediato ni para urgencia meramente administrativa.',
    TRUE
),
(
    'Farmacia_Hospitalaria',
    'Farmacia Hospitalaria',
    'Recetas médicas que requieren validación farmacéutica o dispensación, con prioridad para medicamentos controlados, alto costo o posibles interacciones. NO usar si la receta contiene además un hallazgo crítico (ver Urgencias).',
    FALSE
),
(
    'Gestion_Procedimientos',
    'Procedimientos y Quirófano',
    'Solicitudes de procedimientos o cirugías pendientes que deben agendarse (cirugía, endoscopía, biopsia, procedimiento invasivo). NO usar para procedimientos ya realizados (ver Ficha Clínica).',
    FALSE
),
(
    'Gestion_Interconsultas',
    'Interconsultas y Derivaciones',
    'Interconsultas o derivaciones a otra especialidad, centro o nivel de atención que deben gestionarse e ingresar a lista de espera o agenda.',
    FALSE
),
(
    'Cola_Oncologia',
    'Oncología',
    'Documentos con sospecha o confirmación de malignidad (ej. biopsia positiva para carcinoma, imagen sugerente de neoplasia) que requieren ingreso oportuno a la ruta de atención oncológica. Si además hay riesgo vital inmediato, usar Urgencias.',
    TRUE
),
(
    'Ficha_Clinica',
    'Ficha Clínica',
    'Destino por defecto: documentos informativos que solo deben incorporarse a la historia clínica del paciente, sin acción pendiente (resultados normales o alterados sin riesgo inmediato, epicrisis, protocolos operatorios, informes de control).',
    FALSE
)
ON CONFLICT (codigo) DO NOTHING;
