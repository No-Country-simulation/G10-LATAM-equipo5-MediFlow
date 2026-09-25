# MediFlow API — Backend

API REST de **MediFlow** construida con **FastAPI**. Recibe los documentos clínicos ya procesados por el workflow de IA (n8n), los respalda en Oracle Cloud (OCI Object Storage), los registra en PostgreSQL y ofrece endpoints para consultarlos y auditarlos.

Sigue una **arquitectura por feature (Vertical Slice)**: cada funcionalidad agrupa su propio `router` (endpoints), `service` (lógica), `schemas` (formatos de entrada/salida) y `models` (tablas).

## Estructura del proyecto

```
backend/
├── app/
│   ├── main.py                # Crea la app FastAPI, CORS y registra los routers
│   ├── core/
│   │   ├── config.py          # Variables de entorno (Pydantic Settings)
│   │   ├── database.py        # Conexión asíncrona a PostgreSQL
│   │   └── security.py        # Hash de contraseñas y creación/validación de JWT
│   ├── shared/
│   │   └── oci_client.py      # Cliente de OCI Object Storage
│   └── features/
│       ├── health/            # Estado de la API, la base de datos y OCI
│       ├── auth/              # Login, perfil propio y gestión de usuarios (roles)
│       ├── documents/         # Ingesta de documentos y bandeja con filtros
│       └── audit/             # Revisión humana (Human-in-the-Loop)
├── secrets/                   # Aquí va la clave privada de OCI (.pem, no se sube a git)
├── .env.example
├── requirements.txt
└── README.md
```

## Requisitos previos

- Python 3.11 o superior
- PostgreSQL en ejecución. Lo más simple: `docker compose up -d` desde la **raíz** del repo (ver el README principal).
- Credenciales de OCI con acceso a un bucket de Object Storage

## Instalación local

1. **Crear y activar un entorno virtual** (desde `backend/`):

   ```powershell
   # Windows (PowerShell) — usa el lanzador "py"
   py -3.12 -m venv .venv
   .venv\Scripts\Activate.ps1
   ```

   ```bash
   # Linux / macOS
   python3 -m venv .venv
   source .venv/bin/activate
   ```

   > En Windows, `python`/`pip` pueden no estar en el PATH. El [launcher `py`](https://docs.python.org/3/using/windows.html#launcher) siempre está disponible (`py -0p` lista las versiones). Con el entorno activado ya puedes usar `pip` y `python` directamente.

2. **Instalar dependencias:**

   ```bash
   pip install -r requirements.txt
   ```

3. **Configurar variables de entorno:**

   ```bash
   cp .env.example .env
   ```

   Completa `backend/.env` (ver tabla siguiente).

4. **Colocar la clave de OCI:** guarda tu clave privada como `backend/secrets/oci_api_key.pem` (o ajusta `OCI_KEY_FILE_PATH`). Los `.pem` están ignorados por git.

### Variables de entorno

| Variable | Descripción |
|---|---|
| `PROJECT_NAME` | Nombre de la API (por defecto `MediFlow API`) |
| `ENVIRONMENT` | `development`, `production`, etc. |
| `DATABASE_URL` | Conexión a Postgres con driver async: `postgresql+asyncpg://usuario:clave@localhost:5432/mediflow_db`. Debe coincidir con el `.env` de la raíz |
| `JWT_SECRET_KEY` | Clave secreta para firmar tokens. **Cámbiala** (`openssl rand -hex 32`) |
| `JWT_ALGORITHM` | Algoritmo del JWT (`HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Vida del token en minutos (720 = 12 h en el ejemplo) |
| `OCI_USER_OCID`, `OCI_TENANCY_OCID`, `OCI_FINGERPRINT`, `OCI_REGION` | Datos de tu API Key de OCI |
| `OCI_KEY_FILE_PATH` | Ruta a la clave privada `.pem` |
| `OCI_BUCKET_NAME`, `OCI_COMPARTMENT_OCID` | Bucket y compartimento donde se guardan los documentos |

CORS permite por defecto `http://localhost:3000` y `http://localhost:5173` (`BACKEND_CORS_ORIGINS` en `core/config.py`).

## Ejecución en desarrollo

Desde `backend/`:

```bash
uvicorn app.main:app --reload --port 8000
```

- API: <http://localhost:8000>
- Swagger UI: <http://localhost:8000/docs>
- ReDoc: <http://localhost:8000/redoc>

Comprobación de estado:

```bash
curl http://localhost:8000/api/v1/health
```

Devuelve `200 OK` si la base de datos y OCI funcionan, o `503 Service Unavailable` si alguno falla.

## Autenticación y roles

La API usa **JWT**. Flujo:

1. Inicia sesión con `POST /api/v1/auth/login` (`{"username": "...", "password": "..."}`). Devuelve `access_token` y los datos del usuario.
2. Envía el token en cada petición: `Authorization: Bearer <access_token>`.

Usuario de desarrollo creado por `docker/postgres/init.sql`: `admin_user` / `admin123` (rol `ADMIN`). **Cámbialo fuera de desarrollo.**

| Rol | Acceso |
|---|---|
| `ADMIN` | Todos los endpoints |
| `GESTOR_USUARIOS` | Gestión de usuarios (`/users`) |
| `AUDITOR_CLINICO` | Documentos y auditoría |

Sin token válido → `401`. Con token pero sin el rol requerido → `403`.

## Endpoints

Todos con prefijo `/api/v1`.

### Salud
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/health` | Estado de la base de datos y OCI | Público |

### Autenticación y perfil
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| POST | `/auth/login` | Inicia sesión y devuelve el JWT | Público |
| POST | `/auth/logout` | Cierra la sesión: invalida el token actual (queda en la tabla `revoked_tokens` hasta que expira). Responde `204`. El frontend debe además borrar el token guardado | Autenticado |
| GET | `/auth/me` | Datos básicos del usuario autenticado | Autenticado |
| GET | `/users/me` | Perfil completo propio | Autenticado |
| PATCH | `/users/me` | Editar propio `full_name` y/o `email` | Autenticado |
| POST | `/users/me/change-password` | Cambiar contraseña (pide la actual; nueva de mínimo 8 caracteres). Responde `204` | Autenticado |

### Gestión de usuarios
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/users` | Lista paginada de usuarios | `ADMIN`, `GESTOR_USUARIOS` |
| POST | `/users` | Crea un usuario (`username`, `email`, `password`, `full_name`, `role`; rol por defecto `AUDITOR_CLINICO`) | `ADMIN`, `GESTOR_USUARIOS` |
| PATCH | `/users/{user_id}` | Cambia nombre, email, rol o activa/desactiva | `ADMIN`, `GESTOR_USUARIOS` |

### Documentos
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| POST | `/documents/ingest` | Recibe un documento procesado por n8n, lo sube a OCI y lo registra. Responde `201` | `ADMIN`, `AUDITOR_CLINICO` |
| GET | `/documents` | Bandeja central paginada con filtros | `ADMIN`, `AUDITOR_CLINICO` |

**Ingesta.** n8n debe autenticarse con una cuenta de servicio (rol `ADMIN` o `AUDITOR_CLINICO`) y enviar el payload siguiendo el patrón **Envelope**: `clasificacion` y `datos_generales` son comunes a cualquier documento, y `detalle_clinico` transporta un único bloque poblado según `clasificacion.tipo_documento`. El pipeline solo ingiere **resultados/informes ya emitidos** (no órdenes o derivaciones previas a un estudio):

| `tipo_documento` | Bloque poblado en `detalle_clinico` |
|---|---|
| Receta | `medicamentos` (lista de `{ nombre, dosis, duracion_tratamiento }`) |
| Informe de Laboratorio | `examenes_y_laboratorio` (`estudio_solicitado`, `conclusiones_o_hallazgos`, `paneles`) |
| Informe de Imagenología (TC, RM, Rx, Ecotomografía) | `informe_imagenologico` (`tecnica`, `antecedentes`, `hallazgos`, `impresion_diagnostica`) |
| Nota de Atención Ambulatoria (consulta médica) | `nota_atencion_ambulatoria` (`motivo_consulta`, `antecedentes`, `anamnesis`, `examen_fisico`, `diagnostico_referencia`, `diagnostico_atencion`, `indicaciones`) |
| Epicrisis | `procedimientos_e_internacion` (`fecha_ingreso`, `fecha_alta`, `resumen_evolucion`, `antecedentes_relevantes`, `procedimientos_realizados`) |

Un informe de laboratorio real suele traer **varios paneles** (ej. "Química en Sangre", "Hemograma", "Coagulación"), cada uno con su propia tabla de parámetros y unidades. Por eso `examenes_y_laboratorio.paneles` es una lista de `{ nombre_panel, parametros }`, y cada parámetro es `{ nombre, valor, unidad, rango_referencia, alterado }`.

**`archivos` es una lista, no un archivo único**: un mismo documento puede traer más de un binario (ej. una orden de radiografía con varias placas AP/Lateral/Oblicua, o una ecotomografía con múltiples capturas más su informe). Cada elemento es `{ tipo_archivo, archivo_base64, rol }`; `rol` es libre (ej. `"documento_principal"`, `"imagen_estudio"`) y el primer elemento de la lista se usa como vista previa en la bandeja de auditoría.

Ejemplo con un Informe de Laboratorio (dos paneles, un solo archivo):

```json
{
  "documento_id": "DOC-001",
  "archivos": [
    { "tipo_archivo": "PDF", "archivo_base64": "<contenido en base64>", "rol": "documento_principal" }
  ],
  "clasificacion": {
    "tipo_documento": "Informe de Laboratorio",
    "especialidad": "Cardiología",
    "nivel_prioridad": "Urgente",
    "score_confianza_clasificacion": 0.93
  },
  "datos_generales": {
    "paciente": { "nombre": "Juan Pérez", "edad": 54, "rut": "12.345.678-9" },
    "medico_solicitante": { "nombre": "Dra. Soto", "rut": "9.876.543-2", "matricula": "MED-4321" },
    "diagnostico_principal": "Hipertensión arterial",
    "cie10_sugerido": "I10"
  },
  "detalle_clinico": {
    "examenes_y_laboratorio": {
      "estudio_solicitado": "Perfil lipídico, Hemograma",
      "conclusiones_o_hallazgos": "Colesterol total elevado",
      "paneles": [
        {
          "nombre_panel": "Química en Sangre",
          "parametros": [
            { "nombre": "Colesterol total", "valor": "240", "unidad": "mg/dL", "rango_referencia": "< 200", "alterado": true }
          ]
        },
        {
          "nombre_panel": "Hemograma",
          "parametros": [
            { "nombre": "Hemoglobina", "valor": "16.2", "unidad": "g/dl", "rango_referencia": "14.0 - 17.5", "alterado": false }
          ]
        }
      ]
    }
  },
  "decision_enrutamiento": {
    "destino_principal": "Farmacia_Hospitalaria",
    "requiere_auditoria_humana": false,
    "justificacion_enrutamiento": "Receta estándar",
    "notificacion_generada": { "canal": "Alerta_Guardia_Medica", "mensaje": "..." }
  }
}
```

Campos opcionales: los cinco bloques de `detalle_clinico` (solo debe venir poblado el que corresponda al `tipo_documento`), `rol` en cada archivo, `notificacion_generada` y todo lo del médico/paciente salvo `nombre`. El médico admite tanto **RUT** como **matrícula**.

**Respuesta (`201`)**: es el JSON completo que el frontend React debe usar al terminar el procesamiento. Repite `clasificacion`, `datos_generales`, `detalle_clinico` y `decision_enrutamiento` recibidos, y agrega `status` (`procesado` o `pendiente_auditoria`) y `almacenamiento_oci`, que calcula el backend:

```json
{
  "status": "procesado",
  "documento_id": "DOC-001",
  "clasificacion": { "...": "..." },
  "datos_generales": { "...": "..." },
  "detalle_clinico": { "...": "..." },
  "decision_enrutamiento": { "...": "..." },
  "almacenamiento_oci": {
    "bucket": "mediflow-documents",
    "ruta_objeto": "procesados/urgente/DOC-001.json",
    "rutas_binarios": ["recibidos/DOC-001/0.pdf"],
    "status_backup": "exito"
  }
}
```

**Persistencia en PostgreSQL.** El payload completo (incluyendo el texto libre de `detalle_clinico`, ej. hallazgos de imagenología o evolución de una epicrisis) se guarda íntegro en `raw_extracted_json` como respaldo. Pero el detalle clínico que sí tiene forma de tabla se normaliza en columnas y tablas propias, para poder filtrarlo/agregarlo con SQL en vez de recorrer JSONB:

| Tabla | Contenido | Cardinalidad |
|---|---|---|
| `clinical_documents` | Datos administrativos, clasificación, triaje y enrutamiento (igual que antes) | 1 por documento |
| `clinical_document_attachments` | Un binario por fila (`oci_path`, `tipo_archivo`, `rol`, `orden`) | N por documento |
| `clinical_document_medications` | Un medicamento por fila (Receta) | N por documento |
| `lab_panels` + `lab_parameters` | Un panel por fila, con sus parámetros anidados (Laboratorio) | N paneles × N parámetros |
| `clinical_document_procedures` | Un procedimiento por fila (Epicrisis) | N por documento |

Cada reingreso del mismo `documento_id` reemplaza estas filas (no las acumula). El texto libre de `informe_imagenologico` (hallazgos/impresión) y de la epicrisis (resumen de evolución) se deja solo en `raw_extracted_json`: no hay tabla para eso porque nadie filtra por ese texto, normalizarlo no simplificaría nada.

Errores: `400` si el base64 es inválido, `500` si falla OCI o la base de datos.

**Regla de triaje:** si `score_confianza_clasificacion < 0.85` o `requiere_auditoria_humana` es `true`, el estado es `PENDIENTE_AUDITORIA`; si no, `PROCESADO`.

**Filtros de `GET /documents`** (todos opcionales, combinables):

| Parámetro | Descripción |
|---|---|
| `page`, `page_size` | Paginación (por defecto 1 y 20; máximo 100 por página) |
| `estado` | `PENDIENTE_AUDITORIA`, `PROCESADO` o `AUDITADO` |
| `destino` | Cola de destino, ej. `Cola_Emergencia_Medica`, `Farmacia_Hospitalaria` |
| `rut` | RUT del paciente |
| `prioridad` | `Rutina`, `Prioritario` o `Urgente` |
| `fecha_desde`, `fecha_hasta` | Rango de fecha de creación |

Si no hay resultados, la respuesta trae `items: []` y un `message` explicativo.

### Auditoría (Human-in-the-Loop)
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/audit/{documento_id}` | Detalle del caso, con todos los datos extraídos y una **URL pre-firmada** (`oci_preview_url`) para ver el archivo original | `ADMIN`, `AUDITOR_CLINICO` |
| PUT | `/audit/{documento_id}/resolve` | Guarda la corrección humana y marca el documento como `AUDITADO` | `ADMIN`, `AUDITOR_CLINICO` |

Para resolver, el auditor envía los datos corregidos: `rut_paciente`, `nombre_paciente`, `tipo_documento`, `nivel_prioridad` (`Rutina` / `Prioritario` / `Urgente`), `diagnostico_principal`, `destino_enrutamiento` y `audit_notes` (obligatoria), más opcionales (`edad_paciente`, `medico_nombre`, `medico_rut`, `cie10_sugerido`). Solo se pueden resolver documentos en estado `PENDIENTE_AUDITORIA`. El JSON corregido se guarda en OCI en `procesados/auditados/<id>.json`, y queda registrado qué auditor lo revisó y cuándo.

## Almacenamiento en OCI

| Ruta en el bucket | Contenido |
|---|---|
| `recibidos/<id>.<ext>` | Archivo original |
| `procesados/<prioridad>/<id>.json` | Resultado estructurado de casos automáticos |
| `auditoria_humana/<id>.json` | Resultado de casos pendientes de revisión |
| `procesados/auditados/<id>.json` | Resultado corregido por un auditor |

## Base de datos

El esquema lo crea `docker/postgres/init.sql` (solo la primera vez que arranca el contenedor):

- **`users`**: usuarios, contraseña hasheada (bcrypt), rol y estado activo.
- **`clinical_documents`**: datos del paciente y médico, clasificación, prioridad, score de confianza, diagnóstico/CIE-10, destino, rutas en OCI, JSON completo de la IA (`raw_extracted_json`) y campos de auditoría (`audited_by_id`, `audit_notes`, `audited_at`).

## Pruebas y calidad de código

Desde `backend/`, con el entorno virtual activado:

```bash
pytest          # ejecuta todas las pruebas
pytest -v       # con el detalle de cada prueba
ruff check .    # linter
```

Las pruebas **no necesitan PostgreSQL ni OCI**: usan una sesión de base de datos y un cliente OCI simulados (ver `tests/conftest.py`), y fijan sus propias variables de entorno, así que tampoco dependen de tu `.env`.

| Archivo | Qué verifica |
|---|---|
| `test_security.py` | Hash de contraseñas y tokens JWT (`exp`, `jti` único) |
| `test_ingest_service.py` | Regla de triaje (umbral 0.85), subida a OCI, compensación ante fallos de OCI o base de datos, médico por RUT |
| `test_documents_api.py` | Ingesta (401/403/400/500), JSON completo de respuesta para React, listado paginado y filtros |
| `test_auth_api.py` | Login, token inválido, usuario inactivo, logout, token revocado, restricción por rol |
| `test_audit_api.py` | Detalle del caso, resolución, validaciones y errores (404/400/422/500) |
| `test_health_api.py` | `200` si todo funciona, `503` si falla alguna dependencia |

> Las pruebas usan datos simulados, así que no detectan errores de SQL real (por ejemplo, un nombre de columna incorrecto). Para eso hace falta probar contra el Postgres de `docker compose`.

## Problemas comunes

| Síntoma | Causa probable |
|---|---|
| `/health` responde `503` | Postgres apagado (`docker compose up -d`), `DATABASE_URL` incorrecta o credenciales/clave OCI inválidas |
| `401` en un endpoint | Falta el header `Authorization: Bearer ...` o el token expiró |
| `403` en un endpoint | Tu rol no tiene permiso para ese recurso |
| El login del usuario semilla falla | El volumen de Postgres ya existía; ejecuta `docker compose down -v` y vuelve a levantar |
