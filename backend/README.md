# MediFlow API — Backend

API REST de **MediFlow** construida con **FastAPI**. Recibe los documentos clínicos procesados por el workflow de IA (n8n), los normaliza y valida, calcula su score de confianza, detecta duplicados, los respalda en **OCI Object Storage** y los registra en **PostgreSQL**. También ofrece la bandeja, el detalle de cada documento, la auditoría humana con corrección e historial, y las **tablas maestras** que n8n usa para armar el prompt.

**Índice:** [Estructura](#estructura-del-proyecto) · [Instalación](#instalación-local) · [Variables](#variables-de-entorno) · [Autenticación](#autenticación-y-roles) · [Endpoints](#endpoints) · [Documentos](#documentos) · [Auditoría y corrección](#auditoría-y-corrección-human-in-the-loop) · [Catálogos](#tablas-maestras-catálogos) · [OCI](#almacenamiento-en-oci) · [Base de datos](#base-de-datos) · [Logs](#logs) · [Pruebas](#pruebas-y-calidad-de-código) · [Problemas comunes](#problemas-comunes)

---

## Estructura del proyecto

Arquitectura **por feature (Vertical Slice)**: cada funcionalidad agrupa su `router` (endpoints), `service` (lógica), `schemas` (entrada/salida) y `models` (tablas).

```
backend/
├── app/
│   ├── main.py                  # App FastAPI, CORS, logs por petición y routers
│   ├── cli.py                   # `python -m app.cli create-admin` (primer ADMIN en producción)
│   ├── core/                    # config (variables), database, security (bcrypt/JWT),
│   │                            # rate_limit (bloqueo de login), log_config y request_logging
│   ├── shared/                  # oci_client (Object Storage) y schema_order (orden de JSON Schema)
│   └── features/
│       ├── health/              # Estado de la API, la base y OCI
│       ├── auth/                # Login, refresh, perfil y gestión de usuarios
│       ├── documents/           # Ingesta, bandeja, detalle y duplicados:
│       │   ├── fields.py        #   tipos de campo tolerantes ("NO DISPONIBLE" → null, recortes...)
│       │   ├── normalization.py #   identificación por país, CIE-10, país ISO
│       │   ├── scoring.py       #   score de confianza con motivos
│       │   ├── forms.py         #   esquema de campos por tipo (auditoría y n8n)
│       │   ├── detail.py        #   detalle con URLs pre-firmadas
│       │   └── duplicates.py    #   archivo idéntico y contenido similar
│       ├── audit/               # Tomar, resolver, descartar y corregir (changes.py arma el historial)
│       └── catalogs/            # Tipos de documento, colas y áreas (CRUD + Smart Delete + historial)
├── tests/                       # pytest (no requieren Postgres ni OCI)
├── secrets/                     # Clave privada de OCI (.pem, ignorada por git)
├── .env.example
└── requirements.txt / requirements-dev.txt
```

---

## Instalación local

Requisitos: **Python 3.11+** y **PostgreSQL** en ejecución (lo más simple: `docker compose up -d` desde la raíz, ver el [README principal](../README.md#paso-1--base-de-datos-y-n8n-docker)). Las credenciales de OCI son *opcionales para empezar*.

Todos los comandos se ejecutan **dentro de `backend/`**.

### 1. Entorno virtual

```powershell
# Windows (PowerShell)
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
```

```bash
# Linux / macOS
python3 -m venv .venv
source .venv/bin/activate
```

> - En Windows, si `python` no está en el PATH, usa el [launcher `py`](https://docs.python.org/3/using/windows.html#launcher) (`py -0p` lista las versiones).
> - Si PowerShell bloquea `Activate.ps1`: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
> - Activa el entorno **cada vez** que abras una terminal (verás `(.venv)` al inicio de la línea).

### 2. Dependencias

```bash
pip install -r requirements-dev.txt
```

### 3. Variables de entorno

```bash
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
```

Con el Postgres de Docker, **los valores del ejemplo ya funcionan** si no cambiaste el `.env` de la raíz.

### 4. Configurar OCI (opcional para empezar)

1. Guarda tu clave privada como `backend/secrets/oci_api_key.pem` (o ajusta `OCI_KEY_FILE_PATH`).
2. Completa las variables `OCI_*` de `backend/.env`.

Sin OCI funcionan login, usuarios y catálogos; fallan la ingesta y el detalle de documentos.

### 5. Levantar y comprobar

```bash
uvicorn app.main:app --reload --port 8000
curl http://localhost:8000/api/v1/health
```

- Swagger UI: <http://localhost:8000/docs> (botón **Authorize** con `admin_user` / `admin123`) · ReDoc: <http://localhost:8000/redoc>
- `/health` responde `200` si la base y OCI funcionan y `503` si alguno falla (`database_status` y `oci_status` dicen cuál).

> Al arrancar, la API crea algunas tablas si no existen, pero **no agrega columnas ni carga semillas**. Con una base anterior, vuelve a ejecutar `init.sql` e `init_catalogo.sql` (ver [Base de datos](#base-de-datos)).

---

## Variables de entorno

| Variable | Por defecto | Descripción |
|---|---|---|
| `PROJECT_NAME`, `ENVIRONMENT` | `MediFlow API`, `development` | Con `ENVIRONMENT=production` se desactivan Swagger/OpenAPI y se exige un `JWT_SECRET_KEY` fuerte |
| `DATABASE_URL` | — | `postgresql+asyncpg://usuario:clave@localhost:5432/mediflow_db` (igual al `.env` de la raíz) |
| `JWT_SECRET_KEY`, `JWT_ALGORITHM` | —, `HS256` | Clave para firmar tokens. **Cámbiala** (`openssl rand -hex 32`, mínimo 32 caracteres en producción) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Vida del access token |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Vida del refresh token; pasado ese plazo sin renovarse, hay que volver a iniciar sesión |
| `LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCKOUT_MINUTES` | `5`, `15` | Tras N fallos seguidos (mismo usuario e IP) el login responde `429` durante esos minutos |
| `INGEST_MAX_FILE_MB`, `INGEST_MAX_FILES` | `10`, `10` | Tamaño máximo por archivo y cantidad de archivos por documento |
| `DOCUMENT_PREVIEW_URL_EXPIRE_MINUTES` | `15` | Vigencia de las URLs pre-firmadas de los archivos originales |
| `OCI_AUTH_MODE` | `api_key` | `api_key` (desarrollo, con `.pem`) o `instance_principal` (VM de OCI, sin llaves) |
| `OCI_USER_OCID`, `OCI_TENANCY_OCID`, `OCI_FINGERPRINT`, `OCI_REGION`, `OCI_KEY_FILE_PATH` | — | Datos de la API Key de OCI |
| `OCI_BUCKET_NAME`, `OCI_COMPARTMENT_OCID` | — | Bucket y compartimento de los documentos |
| `BACKEND_CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173` | Orígenes permitidos, separados por coma (o lista JSON) |
| `BACKEND_CORS_ORIGIN_REGEX` | — | Opcional, para orígenes variables (ej. `https://mediflow-.*\.vercel\.app`) |
| `LOG_LEVEL`, `LOG_FORMAT` | `INFO`, `text` | Nivel y formato (`text` o `json`) de los logs |

---

## Autenticación y roles

La API usa **JWT** con *refresh token* rotativo:

1. `POST /auth/login` con `{"username", "password"}` → `access_token` (30 min), `refresh_token` (7 días) y los datos del usuario.
2. Cada petición lleva `Authorization: Bearer <access_token>`.
3. Al vencer el access token, `POST /auth/refresh` con el refresh token entrega un par nuevo. Cada refresh token es de **un solo uso**.
4. El rol y el estado activo se leen de la base en cada petición: un cambio de rol o una desactivación aplica de inmediato.

| Rol | Acceso |
|---|---|
| `ADMIN` | Todo |
| `AUDITOR_CLINICO` | Documentos (todos), auditoría y corrección |
| `OPERADOR` | Ingesta y documentos **que subió**; sin auditoría ni corrección |
| `GESTOR_USUARIOS` | Usuarios y áreas; sin documentos |

Cualquier usuario autenticado puede **consultar** los catálogos. Sin token válido → `401`; sin el rol requerido → `403`. Usuarios de desarrollo: ver el [README principal](../README.md#usuarios-de-prueba).

---

## Endpoints

Todos con prefijo `/api/v1`.

### Salud

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/health` | Estado de la base de datos y OCI (`200` o `503`) | Público |
| GET | `/health/live` | Liveness: `{"status": "alive"}` sin tocar dependencias | Público |

### Autenticación y perfil

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| POST | `/auth/login` | Devuelve `access_token` y `refresh_token`. `429` si el usuario está bloqueado por intentos fallidos | Público |
| POST | `/auth/refresh` | Body `{"refresh_token"}` → par nuevo. El usado queda revocado; reusarlo, uno vencido o de un usuario inactivo → `401` | Público |
| POST | `/auth/logout` | Revoca el access token y, si se envía, el refresh token (`204`) | Autenticado |
| GET | `/auth/me` | Datos del usuario autenticado | Autenticado |
| GET · PATCH | `/users/me` | Ver y editar el propio `full_name` y `email` | Autenticado |
| POST | `/users/me/change-password` | Cambiar la contraseña (pide la actual; nueva de 8+ caracteres) → `204` | Autenticado |

### Gestión de usuarios

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/users` | Lista paginada | `ADMIN`, `GESTOR_USUARIOS` |
| POST | `/users` | Crea un usuario (`username`, `email`, `password`, `full_name`, `role`, `area_id` **obligatorio** y activo; `cola_ids` opcional: colas que atiende en la Consola de Triaje) | `ADMIN`, `GESTOR_USUARIOS` |
| PATCH | `/users/{user_id}` | Cambia nombre, email, rol, área, estado o colas (`cola_ids` reemplaza todas; `[]` las quita) | `ADMIN`, `GESTOR_USUARIOS` |
| POST | `/users/{user_id}/reset-password` | Body `{"new_password"}` (8 a 72 caracteres): restablece la contraseña de otro usuario sin pedir la actual → `204`. `409` si es tu propia cuenta (usa `/users/me/change-password`); `403` si un no-ADMIN restablece la de un ADMIN | `ADMIN`, `GESTOR_USUARIOS` |
| DELETE | `/users/{user_id}` | Smart Delete: borrado físico si el usuario no tiene actividad; si subió, auditó o tomó documentos, o cambió catálogos, solo se desactiva (el historial de correcciones conserva su username aunque se borre). `409` si es tu propia cuenta; `403` si un no-ADMIN elimina a un ADMIN | `ADMIN`, `GESTOR_USUARIOS` |

Solo un ADMIN puede otorgar el rol ADMIN. Las respuestas de usuario incluyen `area: {id, codigo, nombre}`.

### Documentos

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| POST | `/documents/ingest` | Recibe el documento procesado por n8n (`201`) | `ADMIN`, `AUDITOR_CLINICO`, `OPERADOR` |
| GET | `/documents` | Bandeja paginada con filtros (`estado` y `destino` admiten varios valores separados por coma; `atendido=true` o `false`). Excluye los eliminados salvo `estado=ELIMINADO`, que solo puede pedir un `ADMIN` | `ADMIN`, `AUDITOR_CLINICO`, `OPERADOR` |
| GET | `/documents/stats` | Resumen del inicio: conteos del período (máx. 92 días) por prioridad, estado, día y cola, más las listas de trabajo del rol. Un `OPERADOR` solo cuenta los suyos | `ADMIN`, `AUDITOR_CLINICO`, `OPERADOR` |
| GET | `/documents/triage` | Consola de Triaje: casos activos (procesados o auditados, sin atender) de las colas asistenciales. El `ADMIN` ve todas; `OPERADOR` y `AUDITOR_CLINICO`, solo sus colas asignadas | `ADMIN`, `AUDITOR_CLINICO`, `OPERADOR` |
| GET | `/documents/{documento_id}` | Detalle completo: archivos con URL pre-firmada, detalle clínico, duplicados e historial | `ADMIN`, `AUDITOR_CLINICO`, `OPERADOR` |
| PUT | `/documents/{documento_id}` | Corrige un documento `PROCESADO` o `AUDITADO` (ver [Corrección](#corrección-de-documentos-ya-procesados)) | `ADMIN`, `AUDITOR_CLINICO` |
| POST | `/documents/{documento_id}/attend` | Consola de Triaje: marca el caso como atendido (sale de la consola; no cambia el estado). `409` si no está `PROCESADO` ni `AUDITADO`; `403` si el auditor no tiene esa cola | `ADMIN`, `AUDITOR_CLINICO` |
| DELETE | `/documents/{documento_id}/attend` | Deshace la marca de atendido: el caso vuelve a la consola | `ADMIN`, `AUDITOR_CLINICO` |
| POST | `/documents/{documento_id}/derive` | Deriva el caso a otra cola con un `motivo` (5+ caracteres) que queda en el historial (origen `DERIVACION`) y en el JSON de OCI; en la nueva cola vuelve a estar activo. `403` si el auditor no tiene la cola actual | `ADMIN`, `AUDITOR_CLINICO` |
| POST | `/documents/{documento_id}/delete` | Eliminación lógica con `motivo`: pasa a `ELIMINADO` (se conserva en la base y en OCI) y sale de todos los listados; queda en el historial (origen `ELIMINACION`). `409` si ya estaba eliminado | `ADMIN` |
| POST | `/documents/{documento_id}/restore` | Restaura un documento eliminado al estado que tenía, con `motivo` (origen `RESTAURACION`). `409` si no está eliminado | `ADMIN` |
| POST | `/documents/duplicates/check` | ¿Alguno de estos archivos ya fue subido? (por huella SHA-256) | `ADMIN`, `AUDITOR_CLINICO`, `OPERADOR` |

Un `OPERADOR` solo ve los documentos que subió: los ajenos responden `404` (no `403`, para no revelar qué existe).

### Auditoría

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/audit/{documento_id}` | Caso con `raw_extracted_json`, motivos, asignación y una URL pre-firmada por archivo | `ADMIN`, `AUDITOR_CLINICO` |
| POST · DELETE | `/audit/{documento_id}/claim` | Tomar (o renovar) el caso por 30 min · liberarlo (quien lo tomó o un ADMIN) | `ADMIN`, `AUDITOR_CLINICO` |
| PUT | `/audit/{documento_id}/resolve` | Guarda la corrección → `AUDITADO` | `ADMIN`, `AUDITOR_CLINICO` |
| PUT | `/audit/{documento_id}/discard` | Descarta con `motivo` obligatorio → `DESCARTADO` | `ADMIN`, `AUDITOR_CLINICO` |

### Catálogos

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/catalogs/document-types/forms` | Campos de cada tipo activo (bloque y JSON Schema), listas comunes y esquema de `datos_generales`. Lo usan n8n y el formulario de auditoría | Autenticado |
| GET | `/catalogs/{document-types \| queues \| areas}/active` | Registros activos en formato compacto | Autenticado |
| GET | `/catalogs/{...}` · `/catalogs/{...}/{id}` | Listar (filtro `?is_active=`) u obtener un registro | Autenticado |
| GET | `/catalogs/{...}/{id}/history` | Historial de cambios (aunque el registro se haya eliminado) | `ADMIN` (áreas: también `GESTOR_USUARIOS`) |
| POST · PUT · DELETE | `/catalogs/{...}` · `/catalogs/{...}/{id}` | Crear, modificar (solo los campos enviados) o eliminar (Smart Delete) | `ADMIN` (áreas: también `GESTOR_USUARIOS`) |

---

## Documentos

### Ingesta (contrato v2)

n8n reenvía el token del usuario que subió el documento, que queda en `uploaded_by_id`; su área se copia en `area_origen_id`. El payload sigue el patrón **Envelope**:

| Bloque | Contenido |
|---|---|
| `documento_id`, `archivos[]` | ID generado por n8n (`DOC-<uuid>`, solo `A-Z a-z 0-9 _ -`) y archivos en base64 (`PDF`, `PNG`, `JPG`, `TIFF`, `DCM`; el **primero** es el principal y debe ser PDF, PNG o JPG) |
| `clasificacion` | `tipo_documento` (código de un tipo activo), `especialidad`, `nivel_prioridad` (`Rutina` / `Prioritario` / `Urgente`) |
| `evaluacion` | Autoevaluación de la IA: `legibilidad` y `certeza_tipo` (`alta`/`media`/`baja`), `evidencia_tipo`, `campos_dudosos`, `documentos_multiples`, `es_documento_clinico`, `modelo`, `escalado` |
| `datos_generales` | `paciente` (nombre, `identificacion {tipo, numero, pais}`, edad, fecha de nacimiento, sexo, `numero_ficha`), `profesionales[]` (con rol), `institucion_emisora`, `fecha_documento`, `diagnosticos[]` (con CIE-10, tipo, certeza y origen) |
| `detalle_clinico` | Listas comunes (`medicamentos`, `examenes_solicitados`) más **un solo bloque** propio del tipo |
| `decision_enrutamiento` | `destino_principal` (código de una cola activa), `requiere_auditoria_humana`, `justificacion_enrutamiento`, `notificacion_generada` |

| Tipo | Bloque propio en `detalle_clinico` |
|---|---|
| `LABORATORIO` | `examenes_y_laboratorio` (paneles con parámetros; cada parámetro con `alterado` y `critico`) |
| `IMAGENES` | `informe_imagenologico` (modalidad, región, técnica, hallazgos, impresión diagnóstica) |
| `EPICRISIS` | `procedimientos_e_internacion` |
| `SOLICITUD_PROCEDIMIENTO` · `INTERCONSULTA` · `ANATOMIA_PATOLOGICA` · `PROTOCOLO_OPERATORIO` · `NOTA_ATENCION` | `solicitud_procedimiento` · `interconsulta` · `anatomia_patologica` · `protocolo_operatorio` · `nota_atencion_ambulatoria` |
| `RECETA`, `OTRO` | Ninguno (una receta son sus `medicamentos`) |
| `SOLICITUD_EXAMENES`, `ATENCION_URGENCIA`, `CERTIFICADO_MEDICO` y cualquier tipo con `campos_extraccion` | `campos_adicionales`, validado contra el JSON Schema del tipo |

El esquema exacto (etiquetas, opciones, largos) lo publica `GET /catalogs/document-types/forms`. Los campos son **tolerantes**: "NO DISPONIBLE", plantillas vacías o fechas ilegibles quedan en `null`, un texto largo se recorta y una opción desconocida toma su valor por defecto, en vez de rechazar el documento.

<details>
<summary>Ejemplo de payload</summary>

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
      "paneles": [{
        "nombre_panel": "Electrolitos", "muestra": "Sangre",
        "parametros": [{ "nombre": "Sodio", "valor": "146", "unidad": "mEq/L", "rango_referencia": "136 - 145", "alterado": true, "critico": false }]
      }]
    }
  },
  "decision_enrutamiento": { "destino_principal": "Ficha_Clinica", "requiere_auditoria_humana": false, "justificacion_enrutamiento": "Alteración leve", "notificacion_generada": null }
}
```
</details>

**Respuesta (`201`):** los datos **normalizados**, `status` (`PROCESADO` o `PENDIENTE_AUDITORIA`), `score_confianza` (el calculado), `motivos_auditoria` y `almacenamiento_oci`. Errores: `400` base64 inválido · `409` `documento_id` repetido · `422` estructura inválida · `500` falla de OCI o de la base (con compensación: se borra lo ya subido).

### Normalización y score

Antes de guardar, el backend:

- normaliza la identificación (`12.345.678-5` → `12345678-5`) y **valida el dígito verificador** del RUT, CPF y DNI español (también CURP); reconoce un RUT aunque venga rotulado como `OTRO`;
- normaliza el país a ISO alfa-2 (`México` → `MX`) y el CIE-10 a su forma canónica (`j459` → `J45.9`), descartando los inválidos;
- deja un solo diagnóstico `PRINCIPAL` y copia el profesional responsable (informante > tratante > solicitante) en `medico_*`;
- eleva la prioridad a `Urgente` si algún parámetro de laboratorio viene marcado como `critico`.

**Score de confianza** (`scoring.py`): base según `certeza_tipo` (alta 0.95, media 0.80, baja 0.60) × factor de `legibilidad` (alta 1, media 0.92, baja 0.75), menos descuentos por nombre o identificación ausente, identificación o CIE-10 inválidos, campos dudosos o contenido mínimo faltante, con tope si el archivo trae varios documentos o no es clínico. Cada descuento queda como motivo.

### Regla de triaje

El documento queda en `PENDIENTE_AUDITORIA` si se cumple **cualquiera** de estas condiciones (si no, `PROCESADO`):

| Condición | Motivo registrado (ejemplo) |
|---|---|
| Score `< 0.85` | `Score de confianza 0.644 menor al umbral 0.85`, más cada descuento |
| `requiere_auditoria_humana = true` | `El workflow solicitó auditoría humana` |
| Tipo `OTRO` | `Documento no clasificable (tipo OTRO)` |
| Tipo o cola inexistente o inactiva | `El tipo de documento 'X' no existe o está inactivo en el catálogo` |
| Bloque de detalle que no es del tipo | `detalle_clinico trae ['interconsulta'] pero el tipo 'RECETA' espera ...` |
| `campos_adicionales` fuera del esquema | `campos_adicionales no cumple el esquema del tipo 'X': ...` |
| Archivo idéntico a otro documento | `Archivo idéntico a otro documento ya registrado (posible duplicado)` |
| Mismo contenido que otro documento | `Posible duplicado: mismo paciente, tipo y fecha que otro documento ya registrado` |

### Duplicados

Dos niveles (`duplicates.py`), que se complementan:

| Nivel | Cómo se detecta | Cuándo |
|---|---|---|
| **Archivo idéntico** | Misma huella SHA-256 de alguno de los archivos (`clinical_document_attachments.sha256`) | Antes de subir (`POST /documents/duplicates/check`, lo llama el front) y al ingerir |
| **Contenido similar** | Misma identificación del paciente + mismo tipo + misma fecha del documento, y además la misma institución, CIE-10 o diagnóstico principal (sin distinguir mayúsculas ni espacios). Sin identificación o sin fecha no se marca nada; se ignoran los documentos descartados | Al ingerir |

- Un posible duplicado **no se rechaza**: va a auditoría. Los IDs de los documentos relacionados quedan en `raw_extracted_json.triaje.duplicados` y el detalle los entrega en `duplicados[]` (`{documento_id, tipo}`).
- **Privacidad:** se compara contra todos los documentos, pero un OPERADOR solo ve el detalle de los suyos. En `duplicates/check`, de un documento ajeno recibe solo el área y la fecha (`documento_id` y `estado` en `null`); en el detalle, `duplicados[]` solo trae los suyos. Los motivos de auditoría no nombran el otro documento.
- Los adjuntos ingresados antes de existir la huella quedan con `sha256 = NULL`: el nivel por archivo no los detecta, el de contenido sí.

### Filtros de `GET /documents`

| Parámetro | Descripción |
|---|---|
| `page`, `page_size` | Paginación (por defecto 1 y 20; máximo 100) |
| `estado` | `PENDIENTE_AUDITORIA`, `PROCESADO`, `AUDITADO` o `DESCARTADO` |
| `destino`, `prioridad` | Código de cola; `Rutina`, `Prioritario` o `Urgente` |
| `identificacion` | Identificación del paciente, con o sin formato (`12.345.678-5` o `12345678-5`) |
| `numero_ficha` | N° de ficha clínica |
| `area_origen_id` | Área de quien subió el documento |
| `fecha_desde`, `fecha_hasta` | Rango de fecha de creación |

Cada fila trae diagnóstico, CIE-10, médico, `area_origen`, `motivos_auditoria` y quién tiene el caso tomado. Sin resultados: `items: []` y un `message`.

### Detalle (`GET /documents/{documento_id}`)

Además de los campos del listado:

| Campo | Contenido |
|---|---|
| `archivos[]` | `{orden, tipo_archivo, rol, url, visualizable}` con una URL de solo lectura válida por `preview_expira_en_minutos`. Si OCI no puede generar alguna, el detalle se entrega igual con `url: null` y el motivo en `aviso_archivos` |
| `detalle.tablas` | Diagnósticos, profesionales, medicamentos, exámenes solicitados, paneles de laboratorio y procedimientos, desde las tablas normalizadas |
| `detalle.campos_relevantes` | `{campo, etiqueta, valor}` de los campos de texto del bloque del tipo (ej. `hallazgos`), con la etiqueta del esquema |
| `datos_generales`, `detalle_clinico` | Valores vigentes en el formato de la ingesta (precargan el formulario de corrección) |
| `duplicados[]` | Posibles duplicados detectados al ingerir |
| `historial_correcciones[]` | `{origen, justificacion, cambios[], corrected_by_username, corrected_at}`, del más reciente al más antiguo |

Las URLs **no** van en el listado: cada una es una llamada a OCI y crearía enlaces a datos de pacientes que nadie va a abrir.

---

## Auditoría y corrección (Human-in-the-Loop)

### Resolver un caso pendiente

El auditor envía la **misma estructura que la ingesta**: `tipo_documento`, `nivel_prioridad`, `destino_enrutamiento`, `especialidad` (opcional), `datos_generales`, `detalle_clinico` (opcional: si no se envía se conserva el vigente) y `audit_notes` (obligatorio).

- Pasa por las mismas normalizaciones que la ingesta, pero aquí los problemas **bloquean** (`422` con la lista): paciente sin nombre, dígito verificador inválido, CIE-10 sin formato, sin diagnóstico principal, tipo o cola fuera del catálogo, o un bloque que no corresponde al tipo.
- Los CIE-10 nuevos quedan con origen `AUDITOR`.
- El JSON consolidado lleva los valores corregidos arriba, la extracción original en `version_ia` y un bloque `auditoria` con `campos_corregidos`. Se guarda en `procesados/auditados/<id>.json`.
- **Reglas:** solo sobre documentos `PENDIENTE_AUDITORIA` (si no, `409`) y no si otro auditor tiene el caso tomado (`409` "en revisión por X"). El JSON nuevo se sube primero, luego se hace el commit y al final se borra el de `auditoria_humana/`.

### Corrección de documentos ya procesados

`PUT /documents/{documento_id}` con el mismo cuerpo que *resolver*, pero con `justificacion` (obligatoria) en lugar de `audit_notes`:

- Solo para `PROCESADO` o `AUDITADO` (los pendientes se corrigen en auditoría; los descartados no): si no, `409`.
- Mismas validaciones que *resolver* (`422`), y además `422` si la corrección **no cambia ningún valor**.
- El documento **conserva su estado**. Si cambian el tipo, la prioridad o el destino, queda enrutado a la nueva cola.
- El JSON se sobrescribe en su misma ruta de OCI. `version_ia` se guarda la primera vez que alguien corrige y no se vuelve a pisar; cada corrección se agrega a `correcciones[]`. Si falla el commit, se restaura el JSON anterior en OCI.

### Historial de correcciones

Cada resolución de auditoría (`AUDITORIA`, aunque no cambie nada) y cada corrección posterior (`CORRECCION`) agrega una fila a `clinical_document_corrections` con quién, cuándo, la justificación y los `cambios`: una lista `{campo, etiqueta, antes, despues}` con **cada valor modificado**, incluso dentro de listas. Por ejemplo, `examenes_y_laboratorio.paneles[0].parametros[1].valor` con la etiqueta `Paneles 1 › Parámetros 2 › Valor`. Las etiquetas salen de los `title` del esquema, y las diferencias de formato (clave ausente vs `null`, RUT con puntos) no cuentan como cambio.

---

## Tablas maestras (catálogos)

| Maestra | Tabla | Notas |
|---|---|---|
| Tipos de documento | `document_types` | `descripcion` (la lee el LLM para decidir) y `campos_extraccion` opcional (JSON Schema de campos propios) |
| Colas de enrutamiento | `routing_queues` | `descripcion_semantica` (cuándo usar y cuándo no), `notificar_inmediato` y `es_asistencial` (aparece en la Consola de Triaje). `GET /catalogs/queues/summary` las lista con su `id` para asignarlas a usuarios y para derivar |
| Áreas | `areas` | Área de cada usuario y origen de cada documento. No va al prompt y se referencia por id. La gestionan también los `GESTOR_USUARIOS` |

**Reglas comunes:**

- El `codigo` es único (`409`) e **inmutable**, porque los documentos lo guardan. Formato: tipos y áreas `^[A-Z0-9_]+$`, colas `^[A-Za-z0-9_]+$` (`422` si no).
- En un `PUT` solo cambian los campos enviados; los textos e `is_active` no admiten `null`. `campos_extraccion: null` elimina el esquema y, si se envía, debe ser un JSON Schema válido con `"type": "object"`.
- **Desactivar:** `PUT {"is_active": false}`. Un registro inactivo sale de `/active` y, por lo tanto, del prompt.
- **Smart Delete:** si nada lo usa (documentos para tipos y colas; usuarios y documentos para áreas) → borrado físico (`HARD_DELETE`); si algo lo usa → desactivación (`SOFT_DELETE`).
- **Registros de sistema:** el tipo `OTRO` y la cola `Ficha_Clinica` se pueden editar pero no eliminar ni desactivar (`409`).
- **Trazabilidad:** cada cambio guarda quién y cuándo, y una entrada en `catalog_history` con los campos modificados (`{campo: {antes, despues}}`).

**Uso desde n8n:** antes de llamar al LLM, el workflow lee `GET /catalogs/document-types/forms` y `GET /catalogs/queues/active` con el token del usuario. El LLM debe devolver **exactamente** los `codigo`.

---

## Almacenamiento en OCI

| Ruta en el bucket | Contenido |
|---|---|
| `recibidos/<id>/<n>.<ext>` | Archivos originales (nunca se modifican) |
| `procesados/<prioridad>/<id>.json` | Resultado de los casos automáticos |
| `auditoria_humana/<id>.json` | Casos pendientes de revisión |
| `procesados/auditados/<id>.json` | Casos resueltos por un auditor |
| `descartados/<id>.json` | Casos descartados (con el motivo) |

El JSON de cada documento es el mismo que queda en `raw_extracted_json`. Una corrección posterior lo sobrescribe en su ruta actual.

---

## Base de datos

El esquema lo crea `docker/postgres/init.sql`; los tipos y colas semilla, `init_catalogo.sql`; los usuarios de desarrollo, `seed_dev_users.sql`. Docker los ejecuta **solo la primera vez** (volumen vacío).

| Tabla | Contenido |
|---|---|
| `users` · `areas` | Usuarios (bcrypt, rol, área, activo) y maestra de áreas |
| `revoked_tokens` | Tokens invalidados por logout o refresh tokens ya canjeados, hasta su expiración |
| `clinical_documents` | Paciente, profesional responsable, institución, fecha, clasificación, score, diagnóstico y CIE-10, destino, rutas en OCI, JSON consolidado, quién lo subió y desde qué área, asignación y auditoría |
| `clinical_document_attachments` | Un archivo por fila, con su huella `sha256` |
| `clinical_document_diagnoses` · `clinical_document_professionals` | Todos los diagnósticos (con CIE-10 y origen) y profesionales (con rol) |
| `clinical_document_medications` · `clinical_document_requested_exams` | Medicamentos (prescritos o administrados) y exámenes solicitados |
| `lab_panels` + `lab_parameters` · `clinical_document_procedures` | Laboratorio (`alterado`, `critico`) y procedimientos de una epicrisis |
| `clinical_document_corrections` | Historial de correcciones humanas (`AUDITORIA` o `CORRECCION`) |
| `document_types` · `routing_queues` · `catalog_history` | Maestras de tipos y colas, e historial de las tres maestras |

**Datos semilla:** 12 áreas (`init.sql`), 13 tipos y 6 colas (`init_catalogo.sql`; re-ejecutarlo **actualiza** nombre, descripción y campos de los registros semilla) y un usuario por rol con su área (`seed_dev_users.sql`, solo desarrollo).

### Actualizar una base existente

`init.sql` es **re-ejecutable**: crea lo que falta, agrega columnas nuevas (`ADD COLUMN IF NOT EXISTS`), migra nombres antiguos (`rut_paciente` → `identificacion_paciente`) y no duplica datos. Desde la **raíz**, con el contenedor levantado:

```bash
docker compose exec postgres psql -U mediflow_admin -d mediflow_db -f /docker-entrypoint-initdb.d/init.sql
docker compose exec postgres psql -U mediflow_admin -d mediflow_db -f /docker-entrypoint-initdb.d/init_catalogo.sql
docker compose exec postgres psql -U mediflow_admin -d mediflow_db -f /docker-entrypoint-initdb.d/seed_dev_users.sql   # solo desarrollo
```

> ⚠️ Hazlo **después de cada actualización del código**. Si no, fallan los endpoints que usan las columnas o tablas nuevas (por ejemplo, con áreas el login falla; sin `clinical_document_corrections`, el detalle y la auditoría fallan).

En Git Bash antepón `MSYS_NO_PATHCONV=1 `. No hay Alembic: si cambias una tabla, actualiza **a la vez** `models.py` e `init.sql`, usando siempre `IF NOT EXISTS` / `ON CONFLICT` para que el script siga siendo re-ejecutable.

---

## Logs

Cada línea lleva hora, nivel, **ID de seguimiento** (`X-Request-ID`) y usuario:

```
2026-10-09 21:14:03 INFO    [a1b2c3d4e5f6 admin_user] http: POST /api/v1/users -> 201 (35 ms)
```

Se configura con `LOG_LEVEL` y `LOG_FORMAT`. Qué se registra, cómo seguir una operación del navegador a n8n y al backend, y las reglas para no registrar datos de pacientes: [`docs/LOGS.md`](../docs/LOGS.md).

---

## Pruebas y calidad de código

Desde `backend/`, con el entorno activado:

```bash
pytest          # 302 pruebas
ruff check .    # linter
```

Las pruebas **no necesitan PostgreSQL ni OCI**: usan una sesión y un cliente OCI simulados (`tests/conftest.py`) y fijan sus propias variables de entorno.

| Archivo | Qué verifica |
|---|---|
| `test_ingest_service.py` · `test_documents_api.py` | Regla de triaje, formatos, `documento_id` repetido, compensación ante fallos, contrato v2, respuesta para el front, listado y filtros |
| `test_normalization.py` · `test_scoring.py` · `test_extraction_fields.py` | Identificación por país con dígito verificador, CIE-10, país; cálculo del score; campos tolerantes |
| `test_document_detail_api.py` | Detalle: acceso del OPERADOR, URL por archivo, tablas y campos por tipo, detalle sin URLs si OCI falla, área de origen |
| `test_duplicates.py` | Huella SHA-256, consulta previa y privacidad del OPERADOR, archivo idéntico y contenido similar al ingerir, duplicados en el detalle |
| `test_audit_api.py` | Tomar/liberar, resolver (valores arriba, `version_ia`, detalle clínico, catálogos), descartar, errores |
| `test_document_correction_api.py` | Corrección: roles, estados, validaciones, sin cambios, re-enrutamiento, historial campo a campo, `version_ia` estable, fallos de OCI y de la base |
| `test_auth_api.py` · `test_security.py` · `test_hardening.py` | Login, refresh (rotación y reúso), logout, roles, usuarios y su área, Smart Delete; JWT y bcrypt; bloqueo de login, secreto JWT en producción, `documento_id` seguro, liveness |
| `test_catalogs_api.py` · `test_areas_api.py` · `test_schema_order.py` | CRUD de las tres maestras, permisos, Smart Delete, registros de sistema, historial; orden de los JSON Schema |
| `test_logging.py` · `test_health_api.py` | Formato y contexto de los logs, ID de seguimiento, `500` con código; `200`/`503` de salud |

> Al usar datos simulados, las pruebas no detectan errores de SQL real (ej. una columna mal escrita). Si cambias un modelo, prueba también contra el Postgres de `docker compose`.

---

## Problemas comunes

| Síntoma | Causa probable |
|---|---|
| `/health` responde `503` | Mira `database_status` / `oci_status`: Postgres apagado o `DATABASE_URL` incorrecta; credenciales o `.pem` de OCI inválidos o sin configurar |
| `ConnectionRefusedError` o `password authentication failed` | Postgres no está levantado, o `DATABASE_URL` no coincide con el `.env` de la raíz |
| `ModuleNotFoundError` al ejecutar `uvicorn` | El entorno virtual no está activado, o faltan dependencias (`pip install -r requirements-dev.txt`) |
| `401` en un endpoint | Falta `Authorization: Bearer ...` o el token expiró (el front lo renueva solo con el refresh token) |
| `403` en un endpoint | Tu rol no tiene permiso para ese recurso |
| `429` en el login | Demasiados intentos fallidos: espera `LOGIN_LOCKOUT_MINUTES` |
| El login del usuario semilla falla, o `/catalogs/.../active` devuelve `[]` | El volumen ya existía y los scripts no se ejecutaron: ver [Actualizar una base existente](#actualizar-una-base-existente) |
| `500` con `column ... does not exist` o `relation ... does not exist` | Base de una versión anterior: vuelve a ejecutar `init.sql` |
| El puerto `5432` está ocupado | Hay otro PostgreSQL local; detenlo o cambia el puerto en `docker-compose.yml` y en `DATABASE_URL` |
