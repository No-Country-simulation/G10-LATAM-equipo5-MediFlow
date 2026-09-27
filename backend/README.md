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
pip install -r requirements.txt
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

Al arrancar, la API crea las tablas `revoked_tokens`, `routing_queues` y `document_types` si no existen (útil si tu base es anterior a esas features). **No carga los datos semilla**: esos vienen de `init.sql` (ver [Base de datos](#base-de-datos)).

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
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Vida del token en minutos (720 = 12 h en el ejemplo) |
| `OCI_USER_OCID`, `OCI_TENANCY_OCID`, `OCI_FINGERPRINT`, `OCI_REGION` | Datos de tu API Key de OCI |
| `OCI_KEY_FILE_PATH` | Ruta a la clave privada `.pem` |
| `OCI_BUCKET_NAME`, `OCI_COMPARTMENT_OCID` | Bucket y compartimento donde se guardan los documentos |

CORS permite por defecto `http://localhost:3000` y `http://localhost:5173` (`BACKEND_CORS_ORIGINS` en `core/config.py`).

## Autenticación y roles

La API usa **JWT**. Flujo:

1. Inicia sesión con `POST /api/v1/auth/login` (`{"username": "...", "password": "..."}`). Devuelve `access_token` y los datos del usuario.
2. Envía el token en cada petición: `Authorization: Bearer <access_token>`.

Usuarios de desarrollo creados por `docker/postgres/init.sql` (uno por rol). **Cámbialos o desactívalos fuera de desarrollo.**

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin_user` | `admin123` | `ADMIN` |
| `gestor_user` | `gestor123` | `GESTOR_USUARIOS` |
| `auditor_user` | `auditor123` | `AUDITOR_CLINICO` |

| Rol | Acceso |
|---|---|
| `ADMIN` | Todos los endpoints, incluida la escritura de tablas maestras |
| `GESTOR_USUARIOS` | Gestión de usuarios (`/users`) |
| `AUDITOR_CLINICO` | Documentos y auditoría |

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

| Tipo de documento | Bloque poblado en `detalle_clinico` |
|---|---|
| Receta Médica | `medicamentos` (lista de `{ nombre, dosis, duracion_tratamiento }`) |
| Informe de Laboratorio | `examenes_y_laboratorio` (`estudio_solicitado`, `conclusiones_o_hallazgos`, `paneles`) |
| Informe de Estudio por Imágenes (TC, RM, Rx, Ecografía) | `informe_imagenologico` (`tecnica`, `antecedentes`, `hallazgos`, `impresion_diagnostica`) |
| Nota de Atención Ambulatoria (consulta médica) | `nota_atencion_ambulatoria` (`motivo_consulta`, `antecedentes`, `anamnesis`, `examen_fisico`, `diagnostico_referencia`, `diagnostico_atencion`, `indicaciones`) |
| Epicrisis / Informe de Alta | `procedimientos_e_internacion` (`fecha_ingreso`, `fecha_alta`, `resumen_evolucion`, `antecedentes_relevantes`, `procedimientos_realizados`) |

El valor de `clasificacion.tipo_documento` debe ser el `nombre` de un tipo activo de la [tabla maestra](#tablas-maestras-catálogos), y `decision_enrutamiento.destino_principal` el `codigo` de una cola activa. El backend no rechaza valores fuera del catálogo; esa coherencia depende del prompt de n8n.

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

### Tablas maestras (catálogos)

Dos maestras independientes, cada una con su CRUD:

- **Tipos de documento** (`document_types`): qué clases de documento clínico acepta el pipeline.
- **Colas de enrutamiento** (`routing_queues`): a qué área se puede derivar un documento. `descripcion_semantica` explica al LLM cuándo usar y cuándo no usar la cola; `notificar_inmediato` marca las colas que requieren aviso inmediato.

| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/catalogs/queues/active` | Colas activas en formato compacto (`codigo`, `nombre`, `descripcion_semantica`) para el prompt de n8n | Autenticado |
| GET | `/catalogs/queues` | Todas las colas; filtro opcional `?is_active=true\|false` | Autenticado |
| GET | `/catalogs/queues/{id}` | Detalle de una cola | Autenticado |
| POST | `/catalogs/queues` | Crea una cola (`codigo`, `nombre`, `descripcion_semantica`, `notificar_inmediato`). Responde `201` | `ADMIN` |
| PUT | `/catalogs/queues/{id}` | Modifica solo los campos enviados (`nombre`, `descripcion_semantica`, `notificar_inmediato`, `is_active`) | `ADMIN` |
| DELETE | `/catalogs/queues/{id}` | Smart Delete (ver abajo) | `ADMIN` |
| GET | `/catalogs/document-types/active` | Tipos activos en formato compacto (`codigo`, `nombre`, `descripcion`) para el prompt de n8n | Autenticado |
| GET | `/catalogs/document-types` | Todos los tipos; filtro opcional `?is_active=true\|false` | Autenticado |
| GET | `/catalogs/document-types/{id}` | Detalle de un tipo | Autenticado |
| POST | `/catalogs/document-types` | Crea un tipo (`codigo`, `nombre`, `descripcion`). Responde `201` | `ADMIN` |
| PUT | `/catalogs/document-types/{id}` | Modifica solo los campos enviados (`nombre`, `descripcion`, `is_active`) | `ADMIN` |
| DELETE | `/catalogs/document-types/{id}` | Smart Delete (ver abajo) | `ADMIN` |

**Reglas:**

- El `codigo` es único (duplicado → `409`) y **no se puede modificar**, porque los documentos ya guardados lo referencian.
- **Desactivar / reactivar:** `PUT` con `{"is_active": false}` o `{"is_active": true}`. Un registro inactivo deja de aparecer en `/active` y, por lo tanto, en el prompt de n8n.
- **Smart Delete (`DELETE`):** el backend cuenta los documentos clínicos que usan el registro (`destino_enrutamiento = cola.codigo` o `tipo_documento = tipo.nombre`).
  - Si no hay ninguno → **borrado físico**; responde `{"deletion_type": "HARD_DELETE", ...}`.
  - Si hay alguno → **borrado lógico** (`is_active = false`) para no dejar documentos huérfanos; responde `{"deletion_type": "SOFT_DELETE", ...}`.
- Id inexistente → `404`.

**Uso desde n8n:** antes del nodo del LLM, el workflow llama a `GET /catalogs/document-types/active` y `GET /catalogs/queues/active` (con el token Bearer de su cuenta de servicio) e inyecta ambas listas en el prompt. El LLM debe devolver **exactamente** el `nombre` del tipo de documento y el `codigo` de la cola, ya que así se guardan en `clinical_documents` y así los busca el Smart Delete.

## Almacenamiento en OCI

| Ruta en el bucket | Contenido |
|---|---|
| `recibidos/<id>/<n>.<ext>` | Archivos originales (`n` = posición en la lista `archivos`: `0`, `1`, ...) |
| `procesados/<prioridad>/<id>.json` | Resultado estructurado de casos automáticos |
| `auditoria_humana/<id>.json` | Resultado de casos pendientes de revisión |
| `procesados/auditados/<id>.json` | Resultado corregido por un auditor |

## Base de datos

El esquema y los datos semilla los crea `docker/postgres/init.sql`, que Docker ejecuta **solo la primera vez** que arranca el contenedor (con el volumen vacío).

| Tabla | Contenido |
|---|---|
| `users` | Usuarios, contraseña hasheada (bcrypt), rol y estado activo |
| `revoked_tokens` | Tokens JWT invalidados por logout, hasta su expiración |
| `clinical_documents` | Paciente y médico, clasificación, prioridad, score de confianza, diagnóstico/CIE-10, destino, rutas en OCI, JSON completo de la IA (`raw_extracted_json`) y campos de auditoría |
| `clinical_document_attachments`, `clinical_document_medications`, `lab_panels`, `lab_parameters`, `clinical_document_procedures` | Detalle clínico normalizado (ver [Documentos](#documentos)) |
| `document_types` | Tabla maestra de tipos de documento |
| `routing_queues` | Tabla maestra de colas de enrutamiento |

**Datos semilla:** un usuario por rol (`admin_user`, `gestor_user`, `auditor_user`; ver [Autenticación y roles](#autenticación-y-roles)), 9 tipos de documento y 6 colas de enrutamiento.

**¿Tu base es anterior y le faltan tablas o datos?** `init.sql` se puede volver a ejecutar sin riesgo (solo crea lo que falta y no duplica registros). Desde la **raíz** del repo, con el contenedor levantado:

```bash
docker compose exec postgres psql -U mediflow_admin -d mediflow_db -f /docker-entrypoint-initdb.d/init.sql
```

(En Git Bash, antepón `MSYS_NO_PATHCONV=1 `.) La alternativa `docker compose down -v` también funciona, pero **borra todos los datos**.

> No hay herramienta de migraciones (Alembic). Si agregas o cambias una tabla, actualiza **a la vez** el modelo en `models.py` e `init.sql`, usando siempre `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` para que el script siga siendo re-ejecutable.

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
| `test_catalogs_api.py` | CRUD de tablas maestras, permisos (401/403), `409` por código duplicado, `404`, Smart Delete físico y lógico, rutas `/active` |

> Las pruebas usan datos simulados, así que no detectan errores de SQL real (por ejemplo, un nombre de columna incorrecto). Para eso hace falta probar contra el Postgres de `docker compose`.

## Problemas comunes

| Síntoma | Causa probable |
|---|---|
| `/health` responde `503` | Mira `database_status` / `oci_status`. Base: Postgres apagado (`docker compose up -d`) o `DATABASE_URL` incorrecta. OCI: credenciales o clave `.pem` inválidas o sin configurar |
| `ConnectionRefusedError` o `password authentication failed` al usar la API | Postgres no está levantado, o el usuario/contraseña/base de `DATABASE_URL` no coinciden con el `.env` de la raíz |
| `ModuleNotFoundError` al ejecutar `uvicorn` | El entorno virtual no está activado, o `uvicorn` se ejecutó fuera de `backend/` |
| `401` en un endpoint | Falta el header `Authorization: Bearer ...` o el token expiró |
| `403` en un endpoint | Tu rol no tiene permiso para ese recurso |
| El login del usuario semilla falla, o `/catalogs/.../active` devuelve `[]` | El volumen de Postgres ya existía y `init.sql` no se ejecutó; vuelve a ejecutarlo (ver [Base de datos](#base-de-datos)) |
| El puerto `5432` está ocupado al hacer `docker compose up` | Ya tienes otro PostgreSQL local corriendo; detenlo o cambia el puerto publicado en `docker-compose.yml` (y en `DATABASE_URL`) |
