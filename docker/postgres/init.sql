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

-- 1.1 Áreas del hospital (mantenedor: GET/POST /api/v1/catalogs/areas). Cada usuario pertenece a
-- un área y cada documento guarda el área de quien lo subió (`area_origen_id`).
CREATE TABLE IF NOT EXISTS areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    es_sistema BOOLEAN DEFAULT FALSE NOT NULL,
    updated_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Área del usuario. Nullable solo por los usuarios anteriores a las áreas: la API la exige al crear.
-- (`ADD COLUMN IF NOT EXISTS` también migra bases existentes.)
ALTER TABLE users ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas(id);
CREATE INDEX IF NOT EXISTS idx_users_area_id ON users(area_id);

-- 2. Tabla de Documentos Clínicos y Triaje
CREATE TABLE IF NOT EXISTS clinical_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    documento_id VARCHAR(64) UNIQUE NOT NULL,
    estado VARCHAR(30) NOT NULL,
    
    -- Datos del Paciente (Indexados)
    -- Identificación de cualquier país (RUT, DNI, CURP, cédula, CPF, pasaporte), normalizada
    identificacion_paciente VARCHAR(30),
    tipo_identificacion VARCHAR(15),
    pais_identificacion VARCHAR(2),
    nombre_paciente VARCHAR(150),
    edad_paciente INTEGER,
    fecha_nacimiento DATE,
    sexo VARCHAR(1),
    -- N° de ficha / historia clínica / expediente de la institución
    numero_ficha VARCHAR(50),
    
    -- Datos del Profesional
    medico_nombre VARCHAR(150),
    medico_identificacion VARCHAR(30),

    -- Emisor y fecha del documento (fecha del examen, de la atención o de emisión)
    institucion_emisora VARCHAR(200),
    fecha_documento DATE,
    
    -- Clasificación y Triaje Clínico
    tipo_documento VARCHAR(80) NOT NULL,
    especialidad VARCHAR(100),
    nivel_prioridad VARCHAR(20) NOT NULL,
    score_confianza NUMERIC(4, 3) NOT NULL,
    requiere_auditoria BOOLEAN DEFAULT FALSE NOT NULL,
    
    -- Diagnóstico y Derivación
    diagnostico_principal TEXT,
    cie10_sugerido VARCHAR(10),
    -- DOCUMENTO (venía impreso) | INFERIDO (lo propuso la IA) | AUDITOR (lo fijó un auditor)
    cie10_origen VARCHAR(10),
    destino_enrutamiento VARCHAR(80),
    justificacion_enrutamiento TEXT,
    
    -- Trazabilidad OCI Storage
    oci_bucket_name VARCHAR(100) NOT NULL,
    oci_json_path VARCHAR(255) NOT NULL,

    -- Carga Completa del LLM (Respaldo íntegro: incluye texto libre de imagenología,
    -- evolución de epicrisis, etc. que no tiene columna ni tabla relacional propia)
    raw_extracted_json JSONB NOT NULL,

    -- Usuario que subió el documento desde el front (token reenviado por n8n a /ingest)
    uploaded_by_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Área del usuario que subió el documento, copiada al ingerirlo
    area_origen_id UUID REFERENCES areas(id),

    -- Control Human-in-the-Loop
    audited_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    audit_notes TEXT,
    audited_at TIMESTAMP WITH TIME ZONE,

    -- "Tomar caso": auditor que está revisando el documento (asignación con vencimiento)
    asignado_a_id UUID REFERENCES users(id) ON DELETE SET NULL,
    asignado_a_username VARCHAR(50),
    asignado_at TIMESTAMP WITH TIME ZONE,
    atendido_por_id UUID REFERENCES users(id) ON DELETE SET NULL,
    atendido_por_username VARCHAR(50),
    atendido_at TIMESTAMP WITH TIME ZONE,
    eliminado_por_id UUID REFERENCES users(id) ON DELETE SET NULL,
    eliminado_por_username VARCHAR(50),
    eliminado_at TIMESTAMP WITH TIME ZONE,
    motivo_eliminacion TEXT,
    estado_previo VARCHAR(30),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Migración para bases creadas antes de existir `uploaded_by_id` (no hace nada si ya existe)
ALTER TABLE clinical_documents
    ADD COLUMN IF NOT EXISTS uploaded_by_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_clinical_docs_uploaded_by ON clinical_documents(uploaded_by_id);
ALTER TABLE clinical_documents ADD COLUMN IF NOT EXISTS area_origen_id UUID REFERENCES areas(id);
CREATE INDEX IF NOT EXISTS idx_clinical_docs_area_origen ON clinical_documents(area_origen_id);
ALTER TABLE clinical_documents
    ADD COLUMN IF NOT EXISTS asignado_a_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE clinical_documents ADD COLUMN IF NOT EXISTS asignado_a_username VARCHAR(50);
ALTER TABLE clinical_documents ADD COLUMN IF NOT EXISTS asignado_at TIMESTAMP WITH TIME ZONE;
-- Consola de Triaje: caso marcado como atendido (sale de la consola).
ALTER TABLE clinical_documents
    ADD COLUMN IF NOT EXISTS atendido_por_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE clinical_documents ADD COLUMN IF NOT EXISTS atendido_por_username VARCHAR(50);
ALTER TABLE clinical_documents ADD COLUMN IF NOT EXISTS atendido_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_clinical_docs_atendido_at ON clinical_documents(atendido_at);
-- Eliminación lógica (solo ADMIN): estado ELIMINADO, con quién, cuándo, por qué y el estado previo.
ALTER TABLE clinical_documents
    ADD COLUMN IF NOT EXISTS eliminado_por_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE clinical_documents ADD COLUMN IF NOT EXISTS eliminado_por_username VARCHAR(50);
ALTER TABLE clinical_documents ADD COLUMN IF NOT EXISTS eliminado_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE clinical_documents ADD COLUMN IF NOT EXISTS motivo_eliminacion TEXT;
ALTER TABLE clinical_documents ADD COLUMN IF NOT EXISTS estado_previo VARCHAR(30);

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
-- Huella SHA-256 del archivo: detecta cuando se vuelve a subir exactamente el mismo archivo.
-- (Los adjuntos ingresados antes de esta columna quedan en NULL y no participan.)
ALTER TABLE clinical_document_attachments ADD COLUMN IF NOT EXISTS sha256 VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_document_attachments_sha256 ON clinical_document_attachments(sha256);
CREATE INDEX IF NOT EXISTS idx_document_attachments_document_id
ON clinical_document_attachments(document_id);

-- 2.2 Medicamentos de una Receta (detalle_clinico.medicamentos)
CREATE TABLE IF NOT EXISTS clinical_document_medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES clinical_documents(id) ON DELETE CASCADE,
    nombre VARCHAR(200) NOT NULL,
    dosis VARCHAR(100),
    frecuencia VARCHAR(100),
    via VARCHAR(50),
    duracion_tratamiento VARCHAR(100),
    cantidad VARCHAR(100),
    -- PRESCRITO (receta, indicaciones) | ADMINISTRADO (urgencias, ambulancia)
    tipo VARCHAR(15) DEFAULT 'PRESCRITO' NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_document_medications_document_id
ON clinical_document_medications(document_id);

-- 2.3 Paneles y parámetros de un Informe de Laboratorio (detalle_clinico.examenes_y_laboratorio)
CREATE TABLE IF NOT EXISTS lab_panels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES clinical_documents(id) ON DELETE CASCADE,
    nombre_panel VARCHAR(150) NOT NULL,
    muestra VARCHAR(50),
    orden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_lab_panels_document_id ON lab_panels(document_id);

CREATE TABLE IF NOT EXISTS lab_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    panel_id UUID NOT NULL REFERENCES lab_panels(id) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    valor VARCHAR(100),
    unidad VARCHAR(50),
    rango_referencia VARCHAR(100),
    alterado BOOLEAN,
    -- Valor crítico o de pánico informado por el laboratorio: eleva la prioridad a Urgente
    critico BOOLEAN,
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

-- 2.5 Diagnósticos del documento (principal y secundarios, con su CIE-10 y de dónde salió)
CREATE TABLE IF NOT EXISTS clinical_document_diagnoses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES clinical_documents(id) ON DELETE CASCADE,
    descripcion VARCHAR(300),
    cie10 VARCHAR(10),
    tipo VARCHAR(15) DEFAULT 'SECUNDARIO' NOT NULL,      -- PRINCIPAL | SECUNDARIO
    certeza VARCHAR(15) DEFAULT 'PRESUNTIVO' NOT NULL,   -- CONFIRMADO | PRESUNTIVO
    origen_cie10 VARCHAR(10),                            -- DOCUMENTO | INFERIDO | AUDITOR
    orden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_document_diagnoses_document_id ON clinical_document_diagnoses(document_id);
CREATE INDEX IF NOT EXISTS idx_document_diagnoses_cie10 ON clinical_document_diagnoses(cie10);

-- 2.6 Exámenes o estudios pedidos en una orden médica (aún no realizados)
CREATE TABLE IF NOT EXISTS clinical_document_requested_exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES clinical_documents(id) ON DELETE CASCADE,
    codigo VARCHAR(30),                                  -- código de prestación (ej. FONASA)
    nombre VARCHAR(300) NOT NULL,
    categoria VARCHAR(20) DEFAULT 'OTRO' NOT NULL,       -- LABORATORIO | IMAGENOLOGIA | PROCEDIMIENTO | OTRO
    orden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_document_requested_exams_document_id
ON clinical_document_requested_exams(document_id);

-- 2.7 Profesionales del documento con su rol
CREATE TABLE IF NOT EXISTS clinical_document_professionals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES clinical_documents(id) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    identificacion VARCHAR(30),
    registro_profesional VARCHAR(50),                    -- registro, matrícula, cédula profesional
    especialidad VARCHAR(100),
    rol VARCHAR(20) DEFAULT 'OTRO' NOT NULL,             -- SOLICITANTE | INFORMANTE | TRATANTE | DESTINATARIO | OTRO
    orden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_document_professionals_document_id
ON clinical_document_professionals(document_id);

-- 2.8 Historial de correcciones humanas: la resolución de una auditoría y cada corrección
-- posterior de un documento PROCESADO o AUDITADO. `cambios` = [{campo, etiqueta, antes, despues}].
-- El username se guarda desnormalizado para que el historial sobreviva al borrado del usuario.
CREATE TABLE IF NOT EXISTS clinical_document_corrections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES clinical_documents(id) ON DELETE CASCADE,
    origen VARCHAR(20) NOT NULL,                         -- AUDITORIA | CORRECCION
    justificacion TEXT NOT NULL,
    cambios JSONB NOT NULL,
    corrected_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    corrected_by_username VARCHAR(50) NOT NULL,
    corrected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_document_corrections_document_id
ON clinical_document_corrections(document_id, corrected_at DESC);

-- Migración de bases anteriores al modelo v2 (no hace nada si ya está aplicada):
-- `rut_paciente` y `medico_rut` pasan a `identificacion_paciente` y `medico_identificacion`.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'clinical_documents' AND column_name = 'rut_paciente') THEN
        ALTER TABLE clinical_documents RENAME COLUMN rut_paciente TO identificacion_paciente;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'clinical_documents' AND column_name = 'medico_rut') THEN
        ALTER TABLE clinical_documents RENAME COLUMN medico_rut TO medico_identificacion;
    END IF;
END $$;
ALTER TABLE clinical_documents ALTER COLUMN identificacion_paciente TYPE VARCHAR(30);
ALTER TABLE clinical_documents ALTER COLUMN medico_identificacion TYPE VARCHAR(30);
ALTER TABLE clinical_documents ADD COLUMN IF NOT EXISTS tipo_identificacion VARCHAR(15);
ALTER TABLE clinical_documents ADD COLUMN IF NOT EXISTS pais_identificacion VARCHAR(2);
ALTER TABLE clinical_documents ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;
ALTER TABLE clinical_documents ADD COLUMN IF NOT EXISTS sexo VARCHAR(1);
ALTER TABLE clinical_documents ADD COLUMN IF NOT EXISTS numero_ficha VARCHAR(50);
ALTER TABLE clinical_documents ADD COLUMN IF NOT EXISTS institucion_emisora VARCHAR(200);
ALTER TABLE clinical_documents ADD COLUMN IF NOT EXISTS fecha_documento DATE;
ALTER TABLE clinical_documents ADD COLUMN IF NOT EXISTS cie10_origen VARCHAR(10);
ALTER TABLE clinical_document_medications ADD COLUMN IF NOT EXISTS frecuencia VARCHAR(100);
ALTER TABLE clinical_document_medications ADD COLUMN IF NOT EXISTS via VARCHAR(50);
ALTER TABLE clinical_document_medications ADD COLUMN IF NOT EXISTS cantidad VARCHAR(100);
ALTER TABLE clinical_document_medications
    ADD COLUMN IF NOT EXISTS tipo VARCHAR(15) DEFAULT 'PRESCRITO' NOT NULL;
ALTER TABLE lab_panels ADD COLUMN IF NOT EXISTS muestra VARCHAR(50);
ALTER TABLE lab_parameters ADD COLUMN IF NOT EXISTS critico BOOLEAN;
ALTER TABLE lab_parameters ALTER COLUMN valor TYPE VARCHAR(100);
ALTER TABLE lab_parameters ALTER COLUMN unidad TYPE VARCHAR(50);
ALTER TABLE lab_parameters ALTER COLUMN rango_referencia TYPE VARCHAR(100);
DROP INDEX IF EXISTS idx_clinical_docs_rut;

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
    -- Registros de los que depende el pipeline: no se pueden eliminar ni desactivar
    es_sistema BOOLEAN DEFAULT FALSE NOT NULL,
    updated_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Catálogos: tipos de documento clínico admitidos
CREATE TABLE IF NOT EXISTS document_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(80) NOT NULL,
    -- Lo que lee el LLM para elegir el tipo: obligatoria
    descripcion TEXT NOT NULL,
    -- JSON Schema opcional de campos adicionales a extraer (detalle_clinico.campos_adicionales)
    campos_extraccion JSONB,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    es_sistema BOOLEAN DEFAULT FALSE NOT NULL,
    updated_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Migración para bases creadas antes de estas columnas (no hace nada si ya existen)
ALTER TABLE routing_queues ADD COLUMN IF NOT EXISTS es_sistema BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE routing_queues
    ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES users(id) ON DELETE SET NULL;
-- Colas asistenciales (aparecen en la Consola de Triaje). Al agregar la columna en una base
-- existente se marcan las 4 colas clínicas semilla, una sola vez: si se vuelve a ejecutar, la
-- columna ya existe y se respeta lo que el administrador haya cambiado.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'routing_queues' AND column_name = 'es_asistencial'
    ) THEN
        ALTER TABLE routing_queues ADD COLUMN es_asistencial BOOLEAN DEFAULT FALSE NOT NULL;
        UPDATE routing_queues SET es_asistencial = TRUE
        WHERE codigo IN ('Cola_Emergencia_Medica', 'Cola_Oncologia', 'Gestion_Procedimientos', 'Gestion_Interconsultas');
    END IF;
END $$;

-- Colas que atiende cada usuario: en la Consola de Triaje, un OPERADOR o AUDITOR_CLINICO solo ve
-- los casos de sus colas (el ADMIN ve todas).
CREATE TABLE IF NOT EXISTS user_queues (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    queue_id UUID NOT NULL REFERENCES routing_queues(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, queue_id)
);
CREATE INDEX IF NOT EXISTS idx_user_queues_queue ON user_queues(queue_id);
ALTER TABLE document_types ADD COLUMN IF NOT EXISTS campos_extraccion JSONB;
ALTER TABLE document_types ADD COLUMN IF NOT EXISTS es_sistema BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE document_types
    ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES users(id) ON DELETE SET NULL;
UPDATE document_types SET descripcion = nombre WHERE descripcion IS NULL;
ALTER TABLE document_types ALTER COLUMN descripcion SET NOT NULL;

-- Bitácora de cambios de los catálogos. `registro_id` no es FK: el historial sobrevive al
-- borrado físico. `cambios` = {campo: {"antes": ..., "despues": ...}}.
CREATE TABLE IF NOT EXISTS catalog_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    catalogo VARCHAR(30) NOT NULL,           -- QUEUE | DOCUMENT_TYPE | AREA
    registro_id UUID NOT NULL,
    codigo VARCHAR(80) NOT NULL,
    accion VARCHAR(20) NOT NULL,             -- CREATE | UPDATE | HARD_DELETE | SOFT_DELETE
    cambios JSONB NOT NULL,
    changed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_catalog_history_registro
ON catalog_history(catalogo, registro_id, changed_at DESC);

-- 3. Índices de Alto Rendimiento
-- Acelera el conteo del Smart Delete de colas (destino_enrutamiento = routing_queues.codigo)
CREATE INDEX IF NOT EXISTS idx_clinical_docs_destino ON clinical_documents(destino_enrutamiento);
CREATE INDEX IF NOT EXISTS idx_clinical_docs_identificacion ON clinical_documents(identificacion_paciente);
CREATE INDEX IF NOT EXISTS idx_clinical_docs_ficha ON clinical_documents(numero_ficha);
CREATE INDEX IF NOT EXISTS idx_clinical_docs_fecha_documento ON clinical_documents(fecha_documento);
CREATE INDEX IF NOT EXISTS idx_clinical_docs_estado ON clinical_documents(estado);
CREATE INDEX IF NOT EXISTS idx_clinical_docs_pendiente_auditoria 
ON clinical_documents(created_at DESC) 
WHERE estado = 'PENDIENTE_AUDITORIA';

-- 4. Los usuarios de prueba están en seed_dev_users.sql (solo desarrollo).

-- 5. Tipos de documento y colas semilla: ver init_catalogo.sql (se ejecuta después de este
-- archivo y también actualiza las descripciones de una base existente).

-- Áreas semilla. Los usuarios de prueba (seed_dev_users.sql) y el primer ADMIN de producción
-- (`python -m app.cli create-admin --area ADMINISTRACION`) se asignan a una de ellas.
INSERT INTO areas (codigo, nombre, descripcion) VALUES
('ADMINISTRACION', 'Administración y TI', 'Administración del sistema, gestión de usuarios y soporte informático.'),
('ADMISION', 'Admisión y Recepción', 'Recepción de pacientes y digitalización de documentos clínicos que llegan al hospital.'),
('URGENCIAS', 'Servicio de Urgencias', 'Atención de pacientes con riesgo vital o condiciones agudas.'),
('CONSULTAS_AMBULATORIAS', 'Consultas Ambulatorias', 'Policlínicos y consultas de especialidad.'),
('HOSPITALIZACION', 'Hospitalización', 'Unidades de hospitalización médico-quirúrgica.'),
('PABELLON', 'Pabellón y Cirugía', 'Pabellones quirúrgicos y procedimientos invasivos.'),
('LABORATORIO_CLINICO', 'Laboratorio Clínico', 'Análisis de muestras biológicas.'),
('IMAGENOLOGIA', 'Imagenología', 'Radiología, tomografía, resonancia, ecografía y medicina nuclear.'),
('ANATOMIA_PATOLOGICA', 'Anatomía Patológica', 'Estudio de biopsias, piezas quirúrgicas y citologías.'),
('FARMACIA', 'Farmacia Hospitalaria', 'Validación y dispensación de medicamentos.'),
('ONCOLOGIA', 'Oncología', 'Atención y seguimiento de pacientes oncológicos.'),
('AUDITORIA_MEDICA', 'Auditoría Médica', 'Revisión y corrección humana de los documentos clasificados por la IA.')
ON CONFLICT (codigo) DO NOTHING;
