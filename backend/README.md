# MediFlow API — Backend

API REST de **MediFlow** construida con **FastAPI**. Recibe los documentos clínicos ya procesados por el workflow de IA (n8n), los respalda en Oracle Cloud (OCI Object Storage), los registra en PostgreSQL y ofrece endpoints para consultarlos y auditarlos. También expone las **tablas maestras** (tipos de documento y colas de enrutamiento) que n8n usa para armar el prompt del LLM.

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
│       ├── audit/             # Revisión humana (Human-in-the-Loop)
│       └── catalogs/          # Tablas maestras: tipos de documento y colas (CRUD + Smart Delete)
├── tests/                     # Pruebas con pytest (no requieren Postgres ni OCI)
├── secrets/                   # Aquí va la clave privada de OCI (.pem, no se sube a git)
├── .env.example               # Plantilla de backend/.env
├── pytest.ini
├── requirements.txt
└── README.md
```

## Requisitos previos

- **Python 3.11 o superior.**
- **PostgreSQL en ejecución.** Lo más simple es levantarlo con Docker desde la **raíz** del repo (paso 1 del [README principal](../README.md#paso-1--levantar-la-base-de-datos-docker)):
  ```bash
  cp .env.example .env     # en la raíz del repo
  docker compose up -d
  ```
- **Credenciales de OCI** con acceso a un bucket de Object Storage. *Opcional para empezar*: sin ellas la API arranca, pero la ingesta de documentos falla y `/health` responde `503`.

## Instalación local

Todos los comandos de esta sección se ejecutan **dentro de la carpeta `backend/`**.

### 1. Crear y activar un entorno virtual

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

> - En Windows, `python`/`pip` pueden no estar en el PATH. El [launcher `py`](https://docs.python.org/3/using/windows.html#launcher) siempre está disponible (`py -0p` lista las versiones instaladas; usa la que tengas, 3.11 o superior).
> - Si PowerShell bloquea `Activate.ps1` por la política de ejecución, ejecuta una vez `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
> - Con el entorno activado verás `(.venv)` al inicio de la línea y ya puedes usar `pip` y `python` directamente. Debes activarlo **cada vez** que abras una terminal nueva.

### 2. Instalar dependencias

```bash
pip install -r requirements-dev.txt
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env          # Linux / macOS / Git Bash
```
```powershell
Copy-Item .env.example .env   # Windows PowerShell
```

Para desarrollo local con el Postgres de Docker, **los valores del ejemplo ya funcionan** siempre que no hayas cambiado el `.env` de la raíz. Si lo cambiaste, ajusta `DATABASE_URL` para que use el mismo usuario, contraseña y base (ver tabla siguiente).

### 4. Configurar OCI (opcional para empezar)

1. Guarda tu clave privada de API Key como `backend/secrets/oci_api_key.pem` (o ajusta `OCI_KEY_FILE_PATH`). Los `.pem` están ignorados por git.
2. Completa en `backend/.env` las variables `OCI_*` con los datos de tu API Key, bucket y compartimento.

Puedes saltarte este paso para trabajar con login, usuarios y tablas maestras.

### 5. Levantar la API

```bash
uvicorn app.main:app --reload --port 8000
```

- API: <http://localhost:8000>
- Swagger UI (probar endpoints desde el navegador): <http://localhost:8000/docs>
- ReDoc: <http://localhost:8000/redoc>

Al arrancar, la API crea las tablas `revoked_tokens`, `routing_queues`, `document_types` y `areas` si no existen. **No agrega columnas nuevas a tablas existentes ni carga los datos semilla**: si tu base es anterior, vuelve a ejecutar `init.sql` e `init_catalogo.sql` (ver [Base de datos](#base-de-datos)); si no, fallarán los endpoints que usan las columnas nuevas.

### 6. Comprobar que funciona

```bash
curl http://localhost:8000/api/v1/health
```

Devuelve `200 OK` si la base de datos y OCI funcionan, o `503 Service Unavailable` si alguno falla; los campos `database_status` y `oci_status` indican cuál. Luego inicia sesión con `admin_user` / `admin123` en `/docs` (botón **Authorize**).

### Variables de entorno

| Variable | Descripción |
|---|---|
| `PROJECT_NAME` | Nombre de la API (por defecto `MediFlow API`) |
| `ENVIRONMENT` | `development`, `production`, etc. |
| `DATABASE_URL` | Conexión a Postgres con driver async: `postgresql+asyncpg://usuario:clave@localhost:5432/mediflow_db`. Debe coincidir con el `.env` de la raíz |
| `JWT_SECRET_KEY` | Clave secreta para firmar tokens. **Cámbiala** (`openssl rand -hex 32`) |
| `JWT_ALGORITHM` | Algoritmo del JWT (`HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Vida del access token en minutos (30 por defecto) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Vida del refresh token en días (7 por defecto): pasado ese plazo sin renovarse, hay que volver a iniciar sesión |
| `OCI_USER_OCID`, `OCI_TENANCY_OCID`, `OCI_FINGERPRINT`, `OCI_REGION` | Datos de tu API Key de OCI |
| `OCI_KEY_FILE_PATH` | Ruta a la clave privada `.pem` |
| `OCI_BUCKET_NAME`, `OCI_COMPARTMENT_OCID` | Bucket y compartimento donde se guardan los documentos |
| `DOCUMENT_PREVIEW_URL_EXPIRE_MINUTES` | Vigencia en minutos de las URLs pre-firmadas de los archivos originales (15 por defecto) |
| `BACKEND_CORS_ORIGINS` | Orígenes permitidos por CORS, separados por coma (también acepta lista JSON). Por defecto `http://localhost:3000,http://localhost:5173` |
| `BACKEND_CORS_ORIGIN_REGEX` | Opcional. Regex para orígenes variables, ej. `https://mediflow-.*\.vercel\.app` |

## Autenticación y roles

La API usa **JWT**. Flujo:

1. Inicia sesión con `POST /api/v1/auth/login` (`{"username": "...", "password": "..."}`). Devuelve `access_token` y los datos del usuario.
2. Envía el token en cada petición: `Authorization: Bearer <access_token>`.

Usuarios de desarrollo creados por `docker/postgres/seed_dev_users.sql` (uno por rol). **Cámbialos o desactívalos fuera de desarrollo.**

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin_user` | `admin123` | `ADMIN` |
| `gestor_user` | `gestor123` | `GESTOR_USUARIOS` |
| `auditor_user` | `auditor123` | `AUDITOR_CLINICO` |
| `operador_user` | `operador123` | `OPERADOR` |

| Rol | Acceso |
|---|---|
| `ADMIN` | Todos los endpoints, incluida la escritura de tablas maestras |
| `GESTOR_USUARIOS` | Gestión de usuarios (`/users`) |
| `AUDITOR_CLINICO` | Documentos y auditoría |
| `OPERADOR` | Ingesta y bandeja de documentos (solo los que subió); sin auditoría |

Cualquier usuario autenticado puede **consultar** las tablas maestras.

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
| POST | `/auth/login` | Inicia sesión y devuelve `access_token` (vida corta) y `refresh_token` (vida larga) | Público |
| POST | `/auth/refresh` | Body `{"refresh_token": "..."}`. Devuelve un par nuevo de tokens. El refresh token es de **un solo uso** (rotación): el usado queda revocado. `401` si es inválido, expiró, ya se usó o el usuario está inactivo. Un refresh token no sirve como `Authorization: Bearer` | Público (con refresh token) |
| POST | `/auth/logout` | Cierra la sesión: invalida el access token actual y, si se envía en el body `{"refresh_token": "..."}`, también el refresh token (quedan en la tabla `revoked_tokens` hasta que expiran). Responde `204`. El frontend debe además borrar los tokens guardados | Autenticado |
| GET | `/auth/me` | Datos básicos del usuario autenticado | Autenticado |
| GET | `/users/me` | Perfil completo propio | Autenticado |
| PATCH | `/users/me` | Editar propio `full_name` y/o `email` | Autenticado |
| POST | `/users/me/change-password` | Cambiar contraseña (pide la actual; nueva de mínimo 8 caracteres). Responde `204` | Autenticado |

### Gestión de usuarios
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/users` | Lista paginada de usuarios | `ADMIN`, `GESTOR_USUARIOS` |
| POST | `/users` | Crea un usuario (`username`, `email`, `password`, `full_name`, `role`, `area_id`; rol por defecto `AUDITOR_CLINICO`). `area_id` es **obligatorio** y debe ser un [área](#áreas) activa (`422` si no) | `ADMIN`, `GESTOR_USUARIOS` |
| PATCH | `/users/{user_id}` | Cambia nombre, email, rol, área (`area_id`, debe estar activa) o activa/desactiva | `ADMIN`, `GESTOR_USUARIOS` |
| DELETE | `/users/{user_id}` | Smart Delete: borrado físico si el usuario no tiene actividad; si subió, auditó o tomó documentos, o cambió catálogos, solo se desactiva para conservar la autoría. `409` si es tu propia cuenta; `403` si un no-ADMIN intenta eliminar a un ADMIN | `ADMIN`, `GESTOR_USUARIOS` |

Las respuestas de usuario (`/auth/login`, `/auth/me`, `/users`, ...) incluyen `area: {id, codigo, nombre}` (`null` en usuarios creados antes de existir las áreas). El usuario no puede cambiar su propia área desde `PATCH /users/me`.

### Documentos
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| POST | `/documents/ingest` | Recibe un documento procesado por n8n, lo sube a OCI y lo registra. Responde `201` | `ADMIN`, `AUDITOR_CLINICO`, `OPERADOR` |
| GET | `/documents` | Bandeja central paginada con filtros, incluido `area_origen_id` (un `OPERADOR` solo ve los que subió). Cada ítem trae diagnóstico, CIE-10, especialidad, médico y `area_origen` | `ADMIN`, `AUDITOR_CLINICO`, `OPERADOR` |
| GET | `/documents/{documento_id}` | Detalle completo del caso: datos, `area_origen`, archivos originales con **URL pre-firmada** y detalle clínico (tablas y campos relevantes). Un `OPERADOR` solo ve los que subió (`404` para los demás) | `ADMIN`, `AUDITOR_CLINICO`, `OPERADOR` |

**Área de origen.** Al ingerir, el documento guarda en `area_origen_id` el área del usuario que lo subió. Es una copia: si después el usuario cambia de área, el documento conserva el área de la que salió.

**Detalle (`GET /documents/{documento_id}`).** Además de todos los campos del listado:

- `archivos[]`: `{orden, tipo_archivo, rol, url, visualizable}`, con una URL de solo lectura por archivo, válida por `preview_expira_en_minutos` (`DOCUMENT_PREVIEW_URL_EXPIRE_MINUTES`, 15 por defecto). Las URLs **no** se incluyen en el listado: cada una es una llamada a OCI, y generarlas para toda una página sería lento y crearía enlaces a datos de pacientes que nadie va a abrir.
- Si OCI no puede generar alguna URL, el detalle se entrega igual: ese archivo queda con `url: null` y `aviso_archivos` lo explica, para que el caso se pueda revisar con los datos clínicos.
- `detalle.tablas`: `diagnosticos`, `profesionales`, `medicamentos`, `examenes_solicitados`, `paneles_laboratorio` (con sus `parametros`) y `procedimientos`, leídos de las tablas normalizadas.
- `detalle.campos_relevantes`: lista de `{campo, etiqueta, valor}` con los campos de texto no vacíos del bloque del tipo (ej. `hallazgos` e `impresion_diagnostica` en IMAGENES). La etiqueta es el `title` del esquema del tipo: la misma que ve el auditor y que usa n8n.
- Tras una auditoría, tanto las tablas como los campos muestran la versión corregida.

**Ingesta (contrato v2).** n8n reenvía el token Bearer del usuario que subió el documento (rol `ADMIN`, `AUDITOR_CLINICO` u `OPERADOR`); ese usuario queda en `uploaded_by_id`. El payload sigue el patrón **Envelope**:

- `clasificacion`: `tipo_documento` (el `codigo` de un tipo activo), `especialidad`, `nivel_prioridad` y, opcional, el `score_confianza_clasificacion` que reportó la IA.
- `evaluacion`: autoevaluación de la IA, con la que el backend **calcula el score** (ver abajo): `legibilidad` y `certeza_tipo` (`alta` / `media` / `baja`), `evidencia_tipo`, `campos_dudosos`, `documentos_multiples`, `es_documento_clinico`, más `modelo` y `escalado` (los agrega n8n).
- `datos_generales`, comunes a todo tipo:
  - `paciente`: `nombre`, `identificacion` `{tipo, numero, pais}` (tipo `RUT`, `DNI`, `CURP`, `CEDULA`, `CPF`, `PASAPORTE` u `OTRO`; país ISO alfa-2), `edad`, `fecha_nacimiento`, `sexo` (`F`/`M`/`X`), `numero_ficha` (ficha, historia clínica o expediente).
  - `profesionales`: lista de `{nombre, identificacion, registro_profesional, especialidad, rol}`, con rol `INFORMANTE`, `SOLICITANTE`, `TRATANTE`, `DESTINATARIO` u `OTRO`. El responsable (informante > tratante > solicitante) se copia en `medico_nombre` / `medico_identificacion`.
  - `institucion_emisora`, `fecha_documento`.
  - `diagnosticos`: lista de `{descripcion, cie10, tipo (PRINCIPAL|SECUNDARIO), certeza (CONFIRMADO|PRESUNTIVO), origen_cie10 (DOCUMENTO|INFERIDO|AUDITOR)}`. El principal se copia en `diagnostico_principal` / `cie10_sugerido` / `cie10_origen`.
- `detalle_clinico`: las **listas comunes** a todos los tipos (`medicamentos`, `examenes_solicitados`) más, como máximo, **un bloque propio del tipo**.
- `decision_enrutamiento`: `destino_principal` (el `codigo` de una cola activa), `requiere_auditoria_humana`, `justificacion_enrutamiento`, `notificacion_generada`.

| `codigo` del tipo | Bloque propio en `detalle_clinico` |
|---|---|
| `LABORATORIO` | `examenes_y_laboratorio` (`estudio_solicitado`, `conclusiones_o_hallazgos`, `paneles` de `{nombre_panel, muestra, parametros}`; cada parámetro con `alterado` y `critico`) |
| `IMAGENES` | `informe_imagenologico` (`estudio_realizado`, `modalidad`, `region_anatomica`, `tecnica`, `antecedentes`, `hallazgos`, `impresion_diagnostica`) |
| `SOLICITUD_PROCEDIMIENTO` | `solicitud_procedimiento` |
| `EPICRISIS` | `procedimientos_e_internacion` (fechas, evolución, condición e indicaciones al alta, controles, `procedimientos_realizados`) |
| `INTERCONSULTA` | `interconsulta` |
| `ANATOMIA_PATOLOGICA` | `anatomia_patologica` |
| `PROTOCOLO_OPERATORIO` | `protocolo_operatorio` |
| `NOTA_ATENCION` | `nota_atencion_ambulatoria` |
| `RECETA`, `OTRO` | ninguno: el contenido de una receta son los `medicamentos` (lista común) |
| `SOLICITUD_EXAMENES`, `ATENCION_URGENCIA`, `CERTIFICADO_MEDICO` y cualquier tipo con `campos_extraccion` | `campos_adicionales`, validado contra el JSON Schema del tipo |

El esquema exacto de cada bloque (con etiquetas, opciones y largos máximos) lo publica `GET /catalogs/document-types/forms`. Los textos son tolerantes: "NO DISPONIBLE", "NO APLICA", plantillas vacías (`[[...]]`) o fechas no interpretables quedan en `null`, un texto demasiado largo se recorta y una opción desconocida toma su valor por defecto, en vez de rechazar el documento completo.

**Normalización.** Antes de guardar, el backend:

- normaliza la identificación (sin puntos ni espacios: `12345678-5`) y **valida el dígito verificador** del RUT, CPF y DNI español; reconoce un RUT aunque venga rotulado como `OTRO`;
- normaliza el país a ISO alfa-2 (`México` → `MX`) y el CIE-10 a su forma canónica (`j459` → `J45.9`), descartando los códigos sin formato válido;
- deja un solo diagnóstico `PRINCIPAL`;
- eleva la prioridad a `Urgente` si algún parámetro de laboratorio viene marcado como `critico`.

**Score de confianza.** Un LLM califica mal su propia certeza con un número, así que el backend lo calcula (`app/features/documents/scoring.py`): base según `certeza_tipo` (alta 0.95, media 0.8, baja 0.6) × factor de `legibilidad` (alta 1, media 0.92, baja 0.75), menos descuentos por nombre ausente, identificación y ficha ausentes, identificación inválida, CIE-10 inválido, campos dudosos o contenido mínimo faltante (ej. una receta sin medicamentos), con tope si el archivo trae varios documentos o no es clínico. Cada descuento queda como motivo. Sin `evaluacion` (contrato anterior) se usa el score que reportó la IA.

```json
{
  "documento_id": "DOC-001",
  "archivos": [{ "tipo_archivo": "PDF", "archivo_base64": "<base64>", "rol": "documento_principal" }],
  "clasificacion": { "tipo_documento": "LABORATORIO", "especialidad": null, "nivel_prioridad": "Rutina" },
  "evaluacion": { "legibilidad": "alta", "certeza_tipo": "alta", "evidencia_tipo": "Informe de resultados", "campos_dudosos": [] },
  "datos_generales": {
    "paciente": {
      "nombre": "Juan Pérez",
      "identificacion": { "tipo": "RUT", "numero": "12.345.678-5", "pais": "CL" },
      "edad": 54,
      "numero_ficha": "43805"
    },
    "profesionales": [{ "nombre": "TM. Ana Soto", "rol": "INFORMANTE" }],
    "institucion_emisora": "Laboratorio Demo",
    "fecha_documento": "2026-03-24",
    "diagnosticos": []
  },
  "detalle_clinico": {
    "examenes_y_laboratorio": {
      "paneles": [
        {
          "nombre_panel": "Electrolitos",
          "muestra": "Sangre",
          "parametros": [{ "nombre": "Sodio", "valor": "146", "unidad": "mEq/L", "rango_referencia": "136 - 145", "alterado": true, "critico": false }]
        }
      ]
    }
  },
  "decision_enrutamiento": { "destino_principal": "Ficha_Clinica", "requiere_auditoria_humana": false, "justificacion_enrutamiento": "Alteración leve", "notificacion_generada": null }
}
```

**Archivos.** `archivos` es una lista: un documento puede traer varios binarios (`PDF`, `PNG`, `JPG`, `TIFF` o `DCM`). El **primero** es el principal (vista previa en auditoría) y debe ser `PDF`, `PNG` o `JPG`.

**Respuesta (`201`)**: los datos **normalizados** (no los recibidos), `status` (`PROCESADO` o `PENDIENTE_AUDITORIA`), `score_confianza` (el calculado), `motivos_auditoria` y `almacenamiento_oci`.

**Persistencia.** El payload normalizado se guarda íntegro en `raw_extracted_json` (y en OCI), sin el base64 de los archivos y con un bloque `triaje`: `estado`, `score_confianza`, `score_ia`, `score_detalle` (motivos de cada descuento), `ajustes` (ej. prioridad elevada por valor crítico), `motivos_auditoria` y quién lo subió. Lo que se consulta en conjunto vive además en tablas propias:

| Tabla | Contenido |
|---|---|
| `clinical_documents` | Paciente (identificación, ficha, nacimiento, sexo), profesional responsable, institución, fecha del documento, clasificación, diagnóstico principal y CIE-10, triaje y enrutamiento |
| `clinical_document_attachments` | Un binario por fila |
| `clinical_document_diagnoses` | Todos los diagnósticos con su CIE-10 y su origen |
| `clinical_document_professionals` | Profesionales con su rol |
| `clinical_document_medications` | Medicamentos de cualquier tipo de documento (prescritos o administrados) |
| `clinical_document_requested_exams` | Exámenes pedidos en una orden |
| `lab_panels` + `lab_parameters` | Paneles y parámetros de laboratorio (`alterado`, `critico`) |
| `clinical_document_procedures` | Procedimientos realizados (epicrisis) |

Un `documento_id` no se puede reingresar (`409`). Errores: `422` si la estructura es inválida (ej. falta `clasificacion` o `tipo_archivo` no es válido), `400` si el base64 es inválido, `500` si falla OCI o la base de datos.

**Regla de triaje:** el documento queda en `PENDIENTE_AUDITORIA` si se cumple **cualquiera** de estas condiciones (si no, `PROCESADO`):

| Condición | Motivo registrado |
|---|---|
| Score calculado `< 0.85` | `Score de confianza 0.644 menor al umbral 0.85`, seguido de cada descuento (ej. `Identificación RUT con formato o dígito verificador inválido`) |
| `requiere_auditoria_humana = true` | `El workflow solicitó auditoría humana` |
| `tipo_documento = "OTRO"` | `Documento no clasificable (tipo OTRO)` |
| El tipo o la cola no existen o están inactivos | `El tipo de documento 'X' no existe o está inactivo en el catálogo` |
| `detalle_clinico` trae un bloque que no es del tipo | `detalle_clinico trae ['interconsulta'] pero el tipo 'RECETA' espera ningún bloque propio` |
| `campos_adicionales` no cumple el `campos_extraccion` del tipo | `campos_adicionales no cumple el esquema del tipo 'X': ...` |

**Filtros de `GET /documents`** (todos opcionales, combinables):

| Parámetro | Descripción |
|---|---|
| `page`, `page_size` | Paginación (por defecto 1 y 20; máximo 100 por página) |
| `estado` | `PENDIENTE_AUDITORIA`, `PROCESADO`, `AUDITADO` o `DESCARTADO` |
| `destino` | Cola de destino |
| `identificacion` | Identificación del paciente, con o sin formato (`12.345.678-5` o `12345678-5`) |
| `numero_ficha` | N° de ficha clínica |
| `prioridad` | `Rutina`, `Prioritario` o `Urgente` |
| `area_origen_id` | Área de quien subió el documento |
| `fecha_desde`, `fecha_hasta` | Rango de fecha de creación |

Si no hay resultados, la respuesta trae `items: []` y un `message`. Un `OPERADOR` solo ve los documentos que subió.

### Auditoría (Human-in-the-Loop)
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/audit/{documento_id}` | Detalle del caso: datos extraídos, `motivos_auditoria`, asignación y una **URL pre-firmada** (15 min) por cada archivo en `archivos[]` (`oci_preview_url` = la del principal) | `ADMIN`, `AUDITOR_CLINICO` |
| POST | `/audit/{documento_id}/claim` | "Tomar caso" (o renovar) por 30 minutos | `ADMIN`, `AUDITOR_CLINICO` |
| DELETE | `/audit/{documento_id}/claim` | Liberar el caso (quien lo tomó o un `ADMIN`). Responde `204` | `ADMIN`, `AUDITOR_CLINICO` |
| PUT | `/audit/{documento_id}/resolve` | Guarda la corrección humana y marca el documento como `AUDITADO` | `ADMIN`, `AUDITOR_CLINICO` |
| PUT | `/audit/{documento_id}/discard` | Descarta el caso (no clínico, duplicado, ilegible) con `motivo` obligatorio → `DESCARTADO` | `ADMIN`, `AUDITOR_CLINICO` |

**Resolver.** El auditor envía la **misma estructura que la ingesta**: `tipo_documento`, `nivel_prioridad`, `destino_enrutamiento`, `especialidad` (opcional), `datos_generales` y `detalle_clinico` (opcional: si no se envía, se conserva el de la IA), más `audit_notes` (obligatorio). El formulario del frontend dibuja los campos desde `GET /catalogs/document-types/forms`: al elegir otro tipo, muestra los campos de ese tipo.

- Pasa por las mismas normalizaciones que la ingesta, pero aquí los problemas **bloquean** (`422` con la lista): paciente sin nombre, identificación con dígito verificador inválido, CIE-10 sin formato válido, sin diagnóstico principal, tipo o cola fuera del catálogo, o un bloque de `detalle_clinico` que no corresponde al tipo final.
- Los CIE-10 que la IA no había propuesto quedan con origen `AUDITOR`.
- El JSON consolidado lleva **los valores corregidos arriba**, la extracción original en `version_ia`, `triaje.estado = AUDITADO` y un bloque `auditoria` con `campos_corregidos` (`{campo: {antes, despues}}`). Se guarda en OCI (`procesados/auditados/<id>.json`) y en `raw_extracted_json`.

**Reglas comunes a resolver y descartar:** solo sobre documentos `PENDIENTE_AUDITORIA` (si no → `409`), y no si otro auditor tiene el caso tomado y vigente (`409` con "en revisión por X"). Al cerrar el caso se libera la asignación. El JSON nuevo se sube primero, luego se hace el commit y al final se borra el JSON de `auditoria_humana/`.

`GET /documents` incluye en cada fila `motivos_auditoria` y la asignación (`asignado_a_id`, `asignado_a_username`, `asignado_at`), para armar la bandeja sin abrir cada caso.

### Tablas maestras (catálogos)

Tres maestras independientes, cada una con su CRUD (las áreas se describen en [su propia sección](#áreas)):

- **Tipos de documento** (`document_types`): qué clases de documento clínico acepta el pipeline. `descripcion` (obligatoria) explica al LLM cuándo usar el tipo; `campos_extraccion` (opcional) es un JSON Schema con campos adicionales a extraer.
- **Colas de enrutamiento** (`routing_queues`): a qué área se puede derivar un documento. `descripcion_semantica` explica al LLM cuándo usar y cuándo no usar la cola; `notificar_inmediato` marca las colas que requieren aviso inmediato.

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/catalogs/queues/active` | Colas activas en formato compacto (`codigo`, `nombre`, `descripcion_semantica`, `notificar_inmediato`) para el prompt de n8n | Autenticado |
| GET | `/catalogs/queues` | Todas las colas; filtro opcional `?is_active=true\|false` | Autenticado |
| GET | `/catalogs/queues/{id}` | Detalle de una cola | Autenticado |
| GET | `/catalogs/queues/{id}/history` | Historial de cambios de la cola (aunque ya se haya eliminado) | `ADMIN` |
| POST | `/catalogs/queues` | Crea una cola (`codigo`, `nombre`, `descripcion_semantica`, `notificar_inmediato`). Responde `201` | `ADMIN` |
| PUT | `/catalogs/queues/{id}` | Modifica solo los campos enviados (`nombre`, `descripcion_semantica`, `notificar_inmediato`, `is_active`) | `ADMIN` |
| DELETE | `/catalogs/queues/{id}` | Smart Delete (ver abajo) | `ADMIN` |
| GET | `/catalogs/document-types/forms` | Campos de cada tipo activo (`bloque` de `detalle_clinico` y su JSON Schema), las listas comunes y el esquema de `datos_generales`. Lo usan el formulario de auditoría y n8n | Autenticado |
| GET | `/catalogs/document-types/active` | Tipos activos en formato compacto (`codigo`, `nombre`, `descripcion`, `campos_extraccion`) para el prompt de n8n | Autenticado |
| GET | `/catalogs/document-types` | Todos los tipos; filtro opcional `?is_active=true\|false` | Autenticado |
| GET | `/catalogs/document-types/{id}` | Detalle de un tipo | Autenticado |
| GET | `/catalogs/document-types/{id}/history` | Historial de cambios del tipo | `ADMIN` |
| POST | `/catalogs/document-types` | Crea un tipo (`codigo`, `nombre`, `descripcion`, `campos_extraccion`). Responde `201` | `ADMIN` |
| PUT | `/catalogs/document-types/{id}` | Modifica solo los campos enviados (`nombre`, `descripcion`, `campos_extraccion`, `is_active`) | `ADMIN` |
| DELETE | `/catalogs/document-types/{id}` | Smart Delete (ver abajo) | `ADMIN` |

#### Áreas

Áreas o servicios del hospital (Urgencias, Admisión, Laboratorio, ...). Cada usuario pertenece a una y cada documento guarda el área de quien lo subió. A diferencia de las otras maestras, no viajan en el prompt del LLM y se referencian por id (FK), no por `codigo`. Las gestionan quienes registran usuarios.

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/catalogs/areas/active` | Áreas activas en formato compacto (`id`, `codigo`, `nombre`), para el selector del registro de usuarios | Autenticado |
| GET | `/catalogs/areas` | Todas las áreas; filtro opcional `?is_active=true\|false` | Autenticado |
| GET | `/catalogs/areas/{id}` | Detalle de un área | Autenticado |
| GET | `/catalogs/areas/{id}/history` | Historial de cambios del área | `ADMIN`, `GESTOR_USUARIOS` |
| POST | `/catalogs/areas` | Crea un área (`codigo` con formato `^[A-Z0-9_]+$`, `nombre`, `descripcion` opcional). Responde `201` | `ADMIN`, `GESTOR_USUARIOS` |
| PUT | `/catalogs/areas/{id}` | Modifica solo los campos enviados (`nombre`, `descripcion`, `is_active`) | `ADMIN`, `GESTOR_USUARIOS` |
| DELETE | `/catalogs/areas/{id}` | Smart Delete: físico si ningún usuario ni documento la usa; si no, la desactiva | `ADMIN`, `GESTOR_USUARIOS` |

**Reglas:**

- El `codigo` es único (duplicado → `409`) y **no se puede modificar**, porque los documentos ya guardados lo referencian. Formato: tipos `^[A-Z0-9_]+$` (ej. `LICENCIA`), colas `^[A-Za-z0-9_]+$` (ej. `Gestion_GES`); otro formato → `422`.
- En un `PUT`, los campos de texto y `is_active` no admiten `null` (`422`). `campos_extraccion: null` sí: elimina el esquema del tipo.
- `campos_extraccion` debe ser un JSON Schema válido con `"type": "object"` (`422` si no). El LLM llena esos campos en `detalle_clinico.campos_adicionales` y el backend los valida en la ingesta: si no cumplen el esquema, el documento va a auditoría.
- **Desactivar / reactivar:** `PUT` con `{"is_active": false}` o `{"is_active": true}`. Un registro inactivo deja de aparecer en `/active` y, por lo tanto, en el prompt de n8n.
- **Smart Delete (`DELETE`):** el backend cuenta lo que usa el registro: documentos clínicos con `destino_enrutamiento = cola.codigo` o `tipo_documento = tipo.codigo`; para un área, usuarios (`area_id`) y documentos (`area_origen_id`).
  - Si no hay ninguno → **borrado físico**; responde `{"deletion_type": "HARD_DELETE", ...}`.
  - Si hay alguno → **borrado lógico** (`is_active = false`) para no dejar documentos huérfanos; responde `{"deletion_type": "SOFT_DELETE", ...}`.
- **Registros de sistema** (`es_sistema = true`): el tipo `OTRO` (comodín de la IA) y la cola `Ficha_Clinica` (destino por defecto). Se pueden editar, pero no eliminar ni desactivar (`409`).
- **Trazabilidad:** cada alta, cambio o borrado guarda quién lo hizo (`updated_by_id`, `updated_at`) y una entrada en `catalog_history` con solo los campos modificados (`{campo: {antes, despues}}`).
- Id inexistente → `404`.

**Uso desde n8n:** antes del nodo del LLM, el workflow llama a `GET /catalogs/document-types/active` y `GET /catalogs/queues/active` (con el token Bearer del usuario, reenviado por el front) e inyecta ambas listas en el prompt. El LLM debe devolver **exactamente** el `codigo` del tipo de documento y el `codigo` de la cola, ya que así se guardan en `clinical_documents` y así los busca el Smart Delete.

## Almacenamiento en OCI

| Ruta en el bucket | Contenido |
|---|---|
| `recibidos/<id>/<n>.<ext>` | Archivos originales (`n` = posición en la lista `archivos`: `0`, `1`, ...) |
| `procesados/<prioridad>/<id>.json` | Resultado estructurado de casos automáticos |
| `auditoria_humana/<id>.json` | Resultado de casos pendientes de revisión |
| `procesados/auditados/<id>.json` | Resultado corregido por un auditor |
| `descartados/<id>.json` | Casos descartados por un auditor (con el motivo) |

## Base de datos

El esquema lo crea `docker/postgres/init.sql` y el catálogo semilla (tipos de documento y colas) `docker/postgres/init_catalogo.sql`; Docker los ejecuta **solo la primera vez** que arranca el contenedor (con el volumen vacío), en orden alfabético.

| Tabla | Contenido |
|---|---|
| `users` | Usuarios, contraseña hasheada (bcrypt), rol, área (`area_id`) y estado activo |
| `areas` | Tabla maestra de áreas del hospital |
| `revoked_tokens` | Tokens JWT invalidados por logout o refresh tokens ya canjeados, hasta su expiración |
| `clinical_documents` | Paciente y médico, clasificación, prioridad, score de confianza, diagnóstico/CIE-10, destino, rutas en OCI, JSON consolidado (`raw_extracted_json`), quién lo subió (`uploaded_by_id`) y desde qué área (`area_origen_id`), asignación del caso (`asignado_a_*`) y campos de auditoría |
| `clinical_document_attachments`, `clinical_document_medications`, `lab_panels`, `lab_parameters`, `clinical_document_procedures` | Detalle clínico normalizado (ver [Documentos](#documentos)) |
| `document_types` | Tabla maestra de tipos de documento |
| `routing_queues` | Tabla maestra de colas de enrutamiento |
| `catalog_history` | Historial de cambios de las tablas maestras (quién, cuándo y qué cambió) |

**Datos semilla:** 12 áreas (`init.sql`), 13 tipos de documento y 6 colas de enrutamiento (`init_catalogo.sql`; re-ejecutarlo **actualiza** el nombre, la descripción y los campos de los registros semilla), y un usuario por rol con su área (`seed_dev_users.sql`, solo desarrollo): `admin_user` y `gestor_user` → `ADMINISTRACION`, `auditor_user` → `AUDITORIA_MEDICA`, `operador_user` → `ADMISION` (ver [Autenticación y roles](#autenticación-y-roles)). El tipo `OTRO` y la cola `Ficha_Clinica` quedan marcados como registros de sistema.

**¿Tu base es anterior y le faltan tablas, columnas o datos?** `init.sql` se puede volver a ejecutar sin riesgo: crea lo que falta, agrega las columnas nuevas (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) y no duplica registros. Está probado tanto en una base nueva como sobre una base creada con la versión anterior. Desde la **raíz** del repo, con el contenedor levantado:

```bash
docker compose exec postgres psql -U mediflow_admin -d mediflow_db -f /docker-entrypoint-initdb.d/init.sql
docker compose exec postgres psql -U mediflow_admin -d mediflow_db -f /docker-entrypoint-initdb.d/init_catalogo.sql
# En desarrollo, además: asigna el área a los usuarios semilla que aún no la tienen
docker compose exec postgres psql -U mediflow_admin -d mediflow_db -f /docker-entrypoint-initdb.d/seed_dev_users.sql
```

> **Obligatorio tras actualizar al contrato v2 de documentos:** `init.sql` renombra `rut_paciente` → `identificacion_paciente` y `medico_rut` → `medico_identificacion` (conservando los datos) y crea las tablas de diagnósticos, profesionales y exámenes solicitados; sin eso fallan la bandeja y la ingesta.

> **Obligatorio tras actualizar a la versión con áreas:** el modelo `User` ahora lee `users.area_id`, así que con una base anterior **fallan el login y todos los endpoints autenticados** hasta ejecutar `init.sql`.

(En Git Bash, antepón `MSYS_NO_PATHCONV=1 `.) La alternativa `docker compose down -v` también funciona, pero **borra todos los datos**.

> No hay herramienta de migraciones (Alembic). Si agregas o cambias una tabla, actualiza **a la vez** el modelo en `models.py` e `init.sql`, usando siempre `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` para que el script siga siendo re-ejecutable.

## Logs

Cada línea lleva hora, nivel, **ID de seguimiento** (`X-Request-ID`) y usuario:

```
2026-10-09 21:14:03 INFO    [a1b2c3d4e5f6 admin_user] http: POST /api/v1/users -> 201 (35 ms)
```

Se configura con `LOG_LEVEL` y `LOG_FORMAT` (`text` o `json`). El formato está en `app/core/log_config.py` y la línea por petición en `app/core/request_logging.py`. Qué se registra, cómo seguir una operación del navegador a n8n y al backend, y las reglas para no registrar datos de pacientes: [`docs/LOGS.md`](../docs/LOGS.md).

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
| `test_ingest_service.py` | Regla de triaje (umbral 0.85, tipo OTRO, catálogos, bloque vs. tipo, `campos_adicionales` vs. JSON Schema), formatos de archivo, `documento_id` repetido, quién subió el documento, JSON sin base64, subida a OCI, compensación ante fallos de OCI o base de datos, contrato v2 (score con autoevaluación, identificación y CIE-10 inválidos, valor crítico, medicamentos de cualquier tipo, origen del CIE-10, profesional responsable, paciente sin identificación nacional) |
| `test_documents_api.py` | Ingesta (401/403/400/409/500, rol OPERADOR, motivos de auditoría, solo el bloque poblado), JSON completo de respuesta para React, listado paginado y filtros |
| `test_auth_api.py` | Login, token inválido, usuario inactivo, logout, token revocado, refresh token (rotación, reúso, expiración, tipo de token, logout), restricción por rol, área obligatoria y activa al crear/editar usuarios, Smart Delete de usuarios (físico/lógico, propia cuenta, ADMIN) |
| `test_areas_api.py` | Mantenedor de áreas: permisos (ADMIN y GESTOR_USUARIOS escriben), formato de `codigo`, actualización parcial, Smart Delete según usuarios y documentos asociados, historial |
| `test_normalization.py` | Identificación por país (RUT, DNI, CURP, CPF, cédula, pasaporte) con dígito verificador, CIE-10 y país |
| `test_scoring.py` | Cálculo del score: base, legibilidad, descuentos con su motivo, topes |
| `test_extraction_fields.py` | Campos tolerantes: "NO DISPONIBLE", plantillas, fechas, edades, sinónimos, listas |
| `test_schema_order.py` | Orden de los campos de un JSON Schema guardado en JSONB |
| `test_logging.py` | Formato y contexto de los logs, ID de seguimiento (recibido o generado), query sin valores, sondas de salud silenciadas, `500` JSON con código de seguimiento, login fallido sin inyección de líneas |
| `test_document_detail_api.py` | Detalle de documento: acceso (404 para documentos ajenos del OPERADOR), URL por archivo, tablas por tipo, campos relevantes (incluidos los de tipos personalizados), detalle sin URLs si OCI falla; área de origen en la ingesta y en el listado |
| `test_audit_api.py` | Detalle con URL por archivo y motivos, resolución con valores corregidos arriba y `version_ia`, corrección de `detalle_clinico`, validación contra catálogos, descarte, tomar/liberar caso, errores (404/409/422/500) |
| `test_health_api.py` | `200` si todo funciona, `503` si falla alguna dependencia |
| `test_catalogs_api.py` | CRUD de tablas maestras, permisos (401/403), `409` por código duplicado, `404`, Smart Delete físico y lógico, rutas `/active`, formato de `codigo`, `descripcion` obligatoria, `campos_extraccion`, registros de sistema e historial |

> Las pruebas usan datos simulados, así que no detectan errores de SQL real (por ejemplo, un nombre de columna incorrecto). Para eso hace falta probar contra el Postgres de `docker compose`: si cambias un modelo, recrea la base (o vuelve a ejecutar `init.sql`) y prueba el flujo desde Swagger.

## Problemas comunes

| Síntoma | Causa probable |
|---|---|
| `/health` responde `503` | Mira `database_status` / `oci_status`. Base: Postgres apagado (`docker compose up -d`) o `DATABASE_URL` incorrecta. OCI: credenciales o clave `.pem` inválidas o sin configurar |
| `ConnectionRefusedError` o `password authentication failed` al usar la API | Postgres no está levantado, o el usuario/contraseña/base de `DATABASE_URL` no coinciden con el `.env` de la raíz |
| `ModuleNotFoundError` al ejecutar `uvicorn` | El entorno virtual no está activado, o `uvicorn` se ejecutó fuera de `backend/` |
| `401` en un endpoint | Falta el header `Authorization: Bearer ...` o el token expiró |
| `403` en un endpoint | Tu rol no tiene permiso para ese recurso |
| El login del usuario semilla falla, o `/catalogs/.../active` devuelve `[]` | El volumen de Postgres ya existía y `init.sql` no se ejecutó; vuelve a ejecutarlo (ver [Base de datos](#base-de-datos)) |
| `500` con `column ... does not exist` (ej. `es_sistema`, `uploaded_by_id`, `asignado_a_id`) | Tu base es de una versión anterior: vuelve a ejecutar `init.sql` para agregar las columnas nuevas |
| `ModuleNotFoundError: No module named 'jsonschema'` | Falta reinstalar dependencias: `pip install -r requirements-dev.txt` |
| El puerto `5432` está ocupado al hacer `docker compose up` | Ya tienes otro PostgreSQL local corriendo; detenlo o cambia el puerto publicado en `docker-compose.yml` (y en `DATABASE_URL`) |
