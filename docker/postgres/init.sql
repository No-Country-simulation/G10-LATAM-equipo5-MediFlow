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

-- 3. Índices de Alto Rendimiento
CREATE INDEX IF NOT EXISTS idx_clinical_docs_rut ON clinical_documents(rut_paciente);
CREATE INDEX IF NOT EXISTS idx_clinical_docs_estado ON clinical_documents(estado);
CREATE INDEX IF NOT EXISTS idx_clinical_docs_pendiente_auditoria 
ON clinical_documents(created_at DESC) 
WHERE estado = 'PENDIENTE_AUDITORIA';

-- 4. Inserción de Usuario Semilla para Pruebas (Password temporal: admin123)
-- Hash bcrypt correspondiente a "admin123"
INSERT INTO users (username, email, hashed_password, full_name, role)
VALUES (
    'admin_user',
    'administrador@mediflow.cl',
    '$2b$12$5ga92VwMZ957OBX9lcuZ6.yl2OQ5LZl5eeMMMNJ8JUT.Eg1JoFzdW',
    'Administrador MediFlow',
    'ADMIN'
) ON CONFLICT (username) DO NOTHING;