# MediFlow — Agente Autónomo para Triaje, Extracción y Enrutamiento de Documentos Clínicos

> **Hackathon ONE G10** | *Oracle Next Education & Alura*
> **Sector:** HealthTech / Gestión Hospitalaria / Aseguradoras de Salud

**Índice:** [Qué es](#-qué-es-mediflow) · [Funcionalidades](#-funcionalidades) · [Arquitectura](#-arquitectura) · [Puesta en marcha](#-puesta-en-marcha) · [Roles](#-roles-de-usuario) · [Catálogos](#️-tablas-maestras-catálogos) · [API](#-resumen-de-la-api) · [Documentación](#-documentación)

---

## 📋 ¿Qué es MediFlow?

Hospitales y aseguradoras reciben cada día cientos de documentos clínicos (laboratorios, recetas, epicrisis, informes de imágenes, licencias...) que hoy se leen y derivan **a mano**. Es lento y propenso a errores.

**MediFlow** automatiza ese trabajo con Inteligencia Artificial:

1. **Recibe** el documento (PDF o imagen).
2. **Lo clasifica y extrae** los datos clave: paciente (identificación de cualquier país y N° de ficha), profesionales, diagnósticos con CIE-10, prioridad y el detalle propio del tipo (parámetros de laboratorio, medicamentos, hallazgos...).
3. **Calcula su confianza** y **decide a qué cola enviarlo** (Urgencias, Farmacia, Oncología, Ficha Clínica...).
4. Si la confianza es baja o algo no calza, lo deja en una **bandeja de auditoría** para que una persona lo revise y corrija (*Human-in-the-Loop*).
5. **Guarda** los archivos originales y el resultado en **Oracle Cloud (OCI Object Storage)** y lo registra en **PostgreSQL**.

Los tipos de documento, las colas y las áreas **no están fijos en el código**: son tablas maestras que se administran desde la aplicación.

---

## ✨ Funcionalidades

| Módulo | Qué hace |
|---|---|
| **Ingesta con IA** | n8n envía el archivo a Gemini (modelo rápido y, si hay dudas, uno más preciso) y el backend normaliza, valida y calcula el score. |
| **Detección de duplicados** | Antes de procesar, avisa si el mismo archivo ya se subió (huella SHA-256). Al ingerir, marca como *posible duplicado* un documento con el mismo paciente, tipo y fecha que otro. |
| **Bandeja e Inicio** | KPIs por prioridad, carga rápida y lista de documentos. Al hacer clic en cualquier documento se abre su **detalle**: el original (URL pre-firmada) junto a los datos extraídos. |
| **Triaje y Expedientes** | Casos activos por severidad, y repositorio en vista kanban o lista con filtros. |
| **Auditoría (Human-in-the-Loop)** | Tomar el caso, corregir con un formulario que cambia según el tipo de documento, resolver o descartar. |
| **Corrección posterior** | ADMIN y AUDITOR_CLINICO pueden corregir un documento ya procesado o auditado. Cada cambio queda en un **historial** (quién, cuándo, por qué y qué valor cambió). |
| **Usuarios y catálogos** | CRUD de usuarios (cada uno con su área) y mantenedores de tipos de documento, áreas y colas, con historial y *Smart Delete*. |
| **Seguridad y trazabilidad** | JWT con refresh token rotativo, roles, bloqueo de login tras 5 intentos y un ID de seguimiento que une los logs del navegador, n8n y el backend. |

---

## 🧩 Arquitectura

```mermaid
flowchart LR
    U(["👤 Usuario"]) --> FE["🖥️ Frontend<br/>React"]
    FE -- "1 · login (JWT) · bandeja<br/>auditoría · catálogos" --> BE["⚙️ Backend<br/>FastAPI"]
    FE -- "2 · ¿archivo ya subido?" --> BE
    FE -- "3 · sube archivo + token" --> N8N["🤖 n8n<br/>workflow"]
    N8N -- "4 · formularios y colas" --> BE
    N8N -- "5 · clasifica y extrae" --> LLM["🧠 Gemini"]
    N8N -- "6 · POST /documents/ingest" --> BE
    BE --> DB[("🐘 PostgreSQL")]
    BE --> OCI[("☁️ OCI<br/>Object Storage")]
    N8N -. "7 · resultado" .-> FE
```

1. El usuario inicia sesión y obtiene un JWT del backend.
2. Al elegir un archivo, el front calcula su huella y pregunta si ya existe: si es así, avisa **antes** de gastar en la IA.
3. El front sube el documento al **webhook de n8n** junto con su token.
4. n8n lee del backend los **tipos de documento con sus campos** y las **colas activas**.
5. Gemini clasifica y extrae los datos eligiendo **solo** entre las opciones del catálogo. Si el modelo rápido tiene dudas, n8n repite con el preciso.
6. n8n envía el resultado a `POST /documents/ingest`. El backend normaliza (identificación, CIE-10), calcula el score, busca duplicados, aplica el triaje, guarda en **OCI** y registra en **PostgreSQL**.
7. n8n devuelve al front la respuesta del backend.

**Regla de triaje.** El documento queda en `PENDIENTE_AUDITORIA` si se cumple **cualquiera** de estas condiciones (si no, queda `PROCESADO`):

- score de confianza **menor a 0.85** (lo calcula el backend con la autoevaluación de la IA y sus propias validaciones);
- el workflow pide auditoría humana, o el tipo es `OTRO` (no clasificable);
- el tipo o la cola no existen o están inactivos en el catálogo;
- el detalle no corresponde al tipo, o los campos propios del tipo no cumplen su esquema;
- es **posible duplicado** de otro documento (archivo idéntico o mismo paciente, tipo y fecha).

| Estado | Significado | JSON en OCI |
|---|---|---|
| `PROCESADO` | Enrutado automáticamente | `procesados/<prioridad>/<id>.json` |
| `PENDIENTE_AUDITORIA` | Espera revisión humana | `auditoria_humana/<id>.json` |
| `AUDITADO` | Resuelto por un auditor | `procesados/auditados/<id>.json` |
| `DESCARTADO` | Descartado por un auditor (no clínico, duplicado, ilegible) | `descartados/<id>.json` |

Los archivos originales se guardan en `recibidos/<id>/<n>.<extensión>` (`n` = posición del archivo: `0`, `1`, ...). Un documento `PROCESADO` o `AUDITADO` que se corrige después **conserva su estado**: solo cambia su contenido y queda registrado en el historial.

---

## 📁 Estructura del repositorio

```
.
├── backend/                 # API REST en FastAPI            → backend/README.md
├── frontend/                # Aplicación web React + Vite    → frontend/README.md
├── workflow/                # Workflow de n8n y sus pruebas  → workflow/README.md
├── docker/postgres/         # init.sql (esquema) · init_catalogo.sql (tipos y colas) · seed_dev_users.sql (solo dev)
├── deploy/                  # Caddyfile + imagen del front (producción)
├── docs/                    # Despliegue en OCI, logs, QA y documento del sistema
├── docker-compose.yml       # Desarrollo: PostgreSQL 16 + n8n
├── docker-compose.prod.yml  # Producción en OCI: Caddy + front + backend + n8n + PostgreSQL
├── .env.example             # Variables de Docker para desarrollo
└── .env.prod.example        # Variables de producción
```

> Hay **dos archivos `.env`** en desarrollo: el de la **raíz** (usuario, contraseña y base que crea Docker) y `backend/.env` (configuración de la API). El usuario, la contraseña y el nombre de la base deben ser **iguales en ambos**.

---

## 🚀 Puesta en marcha

### Requisitos

| Herramienta | Para qué | Cómo comprobarlo |
|---|---|---|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) (o Docker Engine + Compose) | PostgreSQL y n8n | `docker compose version` |
| Python **3.11 o superior** | Backend | `py -0p` (Windows) o `python3 --version` |
| Node.js **20 o superior** | Frontend | `node --version` |
| Llave de API de **Google Gemini** | Que n8n clasifique documentos | [aistudio.google.com](https://aistudio.google.com/) |
| Credenciales de OCI *(opcional al inicio)* | Guardar documentos en Oracle Cloud | Ver [`backend/README.md`](backend/README.md#4-configurar-oci-opcional-para-empezar) |

> Sin OCI la API **arranca igual**: funcionan el login, los usuarios y los catálogos. Fallan la ingesta y la vista de documentos, y `/health` responde `503`.

Los comandos se ejecutan desde la **raíz del repositorio**, salvo que se indique otra carpeta.

### Paso 1 — Base de datos y n8n (Docker)

```bash
cp .env.example .env            # Windows PowerShell: Copy-Item .env.example .env
docker compose up -d
docker compose ps               # postgres debe quedar "healthy"
```

La primera vez, Docker crea la base y ejecuta en orden `init.sql`, `init_catalogo.sql` y `seed_dev_users.sql`: tablas e índices, **12 áreas**, **13 tipos de documento**, **6 colas** y **un usuario de prueba por rol**.

> ⚠️ Esos scripts corren **solo con el volumen vacío**. Si tu base ya existía, ver [Actualizar una base existente](#actualizar-una-base-existente).

### Paso 2 — Backend

```powershell
# Windows PowerShell
cd backend
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

```bash
# Linux / macOS
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Si no cambiaste el `.env` de la raíz, el `backend/.env` de ejemplo ya apunta a la base correcta. Swagger: <http://localhost:8000/docs>.

### Paso 3 — Workflow de n8n

1. Abrir <http://localhost:5678> y crear el usuario owner.
2. **Import from file** → `workflow/MediFlow_unificado.json`.
3. Crear una credencial **Google Gemini(PaLM) Api** con tu llave y asignarla en los nodos **Gemini rápido** y **Gemini preciso**.
4. Activar el workflow.

Detalle y variables (modelos de Gemini, URL del backend): [`workflow/README.md`](workflow/README.md).

### Paso 4 — Frontend

```bash
cd frontend
cp .env.example .env            # Windows PowerShell: Copy-Item .env.example .env
npm install
npm run dev                     # http://localhost:5173
```

Inicia sesión con un [usuario de prueba](#usuarios-de-prueba) y sube un documento desde **Inicio** o **Procesar Documento IA**.

### Comprobar que todo funciona

| Qué | Cómo | Resultado esperado |
|---|---|---|
| API y dependencias | `curl http://localhost:8000/api/v1/health` | `200` si la base y OCI responden (`503` sin OCI configurado) |
| Login | Botón **Authorize** en `/docs` con `admin_user` / `admin123` | Devuelve `access_token` y `refresh_token` |
| Catálogos | `GET /api/v1/catalogs/queues/active` con el token | Las 6 colas semilla |
| Flujo completo | Subir un PDF desde el front | Resumen con tipo, prioridad, destino y estado |

### Usuarios de prueba

Los crea `seed_dev_users.sql` (solo desarrollo; producción no lo carga):

| Usuario | Contraseña | Rol | Área |
|---|---|---|---|
| `admin_user` | `admin123` | `ADMIN` | Administración y TI |
| `gestor_user` | `gestor123` | `GESTOR_USUARIOS` | Administración y TI |
| `auditor_user` | `auditor123` | `AUDITOR_CLINICO` | Auditoría Médica |
| `operador_user` | `operador123` | `OPERADOR` | Admisión y Recepción |

> ⚠️ Cambia estas contraseñas y el `JWT_SECRET_KEY` antes de cualquier despliegue real.

### Actualizar una base existente

`init.sql` se puede ejecutar varias veces: crea lo que falta, agrega las columnas nuevas y no duplica datos. `init_catalogo.sql` actualiza los tipos y colas semilla. Con los contenedores levantados:

```bash
docker compose exec postgres psql -U mediflow_admin -d mediflow_db -f /docker-entrypoint-initdb.d/init.sql
docker compose exec postgres psql -U mediflow_admin -d mediflow_db -f /docker-entrypoint-initdb.d/init_catalogo.sql
docker compose exec postgres psql -U mediflow_admin -d mediflow_db -f /docker-entrypoint-initdb.d/seed_dev_users.sql
```

- En **Git Bash** antepón `MSYS_NO_PATHCONV=1 `. Los mensajes `NOTICE: ... already exists, skipping` son normales.
- **Hazlo cada vez que actualices el código**: las versiones recientes agregan, por ejemplo, el historial de correcciones (`clinical_document_corrections`) y la huella de los archivos (`sha256`).
- Para empezar de cero: `docker compose down -v && docker compose up -d` (⚠️ **borra todos los datos**).

<details>
<summary>Comandos útiles de Docker</summary>

```bash
docker compose ps                  # estado
docker compose logs -f postgres    # logs de la base (o n8n)
docker compose stop                # detener (conserva los datos)
docker compose down -v             # detener y BORRAR los datos
docker compose exec postgres psql -U mediflow_admin -d mediflow_db   # consola SQL
```

Para un cliente gráfico (DBeaver, pgAdmin): `localhost:5432` con el usuario, contraseña y base del `.env` de la raíz.
</details>

---

## 👥 Roles de usuario

| Rol | Menú | Puede hacer |
|---|---|---|
| `ADMIN` | Inicio · Triaje · Expedientes · Auditoría · Usuarios · Catálogos | Todo |
| `AUDITOR_CLINICO` | Inicio · Triaje · Expedientes · Auditoría | Subir documentos, ver todos, auditar y **corregir** documentos procesados o auditados |
| `OPERADOR` | Inicio · Triaje · Mis Documentos | Subir documentos y ver **solo los que subió** |
| `GESTOR_USUARIOS` | Usuarios · Catálogos (solo Áreas) | Gestionar usuarios y áreas; sin acceso a documentos |

Todos pueden editar su propio perfil, cambiar su contraseña y **consultar** los catálogos.

---

## 🗂️ Tablas maestras (catálogos)

| Maestra | Para qué | Registros semilla |
|---|---|---|
| **Tipos de documento** | Lo que la IA puede clasificar; cada tipo trae su descripción y sus campos a extraer | Receta · Laboratorio · Imágenes · Solicitud de Exámenes · Solicitud de Procedimiento · Epicrisis · Interconsulta · Anatomía Patológica · Protocolo Operatorio · Nota de Atención · Atención de Urgencia · Certificado / Licencia Médica · Otro |
| **Colas de enrutamiento** | A dónde se deriva el documento | Urgencias · Farmacia Hospitalaria · Procedimientos y Exámenes · Interconsultas y Derivaciones · Oncología · Ficha Clínica (por defecto) |
| **Áreas** | Área de cada usuario y área de origen de cada documento | 12 áreas (Admisión, Urgencias, Laboratorio, Auditoría Médica, ...) |

- n8n lee los tipos y colas **antes de cada documento**: agregar o desactivar una opción no requiere tocar el workflow.
- Un tipo nuevo puede definir sus propios campos (`campos_extraccion`, un JSON Schema): la IA los extrae y el formulario de auditoría los muestra.
- Cada cambio queda en un historial. `OTRO` y `Ficha_Clinica` están protegidos porque el sistema depende de ellos.
- **Smart Delete:** si nada usa el registro se borra; si algo lo usa, solo se desactiva.

---

## 🔌 Resumen de la API

Prefijo `/api/v1`. Salvo `health`, `login` y `refresh`, todo requiere `Authorization: Bearer <token>`. Detalle completo en [`backend/README.md`](backend/README.md).

| Área | Endpoints |
|---|---|
| Salud | `GET /health`, `GET /health/live` |
| Autenticación | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| Perfil y usuarios | `/users/me`, `/users/me/change-password`, `/users` (CRUD) |
| Documentos | `POST /documents/ingest` · `GET /documents` (bandeja con filtros) · `GET /documents/stats` (resumen del inicio) · `GET /documents/{id}` (detalle con URLs pre-firmadas, duplicados e historial) · `PUT /documents/{id}` (corregir) · `POST`/`DELETE /documents/{id}/attend` (atendido en triaje) · `POST /documents/duplicates/check` (¿archivo ya subido?) |
| Auditoría | `GET /audit/{id}`, `POST`/`DELETE /audit/{id}/claim`, `PUT /audit/{id}/resolve`, `PUT /audit/{id}/discard` |
| Catálogos | CRUD en `/catalogs/document-types`, `/catalogs/queues` y `/catalogs/areas` (+ `/active` y `/{id}/history`), y `GET /catalogs/document-types/forms` |

---

## 📚 Documentación

| Documento | Contenido |
|---|---|
| [`backend/README.md`](backend/README.md) | Instalación, variables, endpoints, reglas de negocio, base de datos y pruebas |
| [`frontend/README.md`](frontend/README.md) | Pantallas, estructura, variables y qué endpoint usa cada pantalla |
| [`workflow/README.md`](workflow/README.md) | Flujo de n8n, configuración, edición y uso de tokens |
| [`docs/DESPLIEGUE_OCI.md`](docs/DESPLIEGUE_OCI.md) | Despliegue en Oracle Cloud y checklist de seguridad |
| [`docs/LOGS.md`](docs/LOGS.md) | Dónde están los logs y cómo seguir una operación con el ID de seguimiento |
| [`docs/qa/`](docs/qa) | Plan de pruebas, casos de prueba y datos de prueba |
| `docs/Documento Sistema Mediflow.docx` | Documento funcional y técnico completo, con diagramas |
| Swagger (`/docs`, solo fuera de producción) | Probar los endpoints y ver los esquemas exactos |

---

## 🛠️ Tecnologías

**Backend:** FastAPI · Python 3.11+ · SQLAlchemy 2.0 async · Pydantic v2 · JWT · PostgreSQL 16 · OCI Object Storage
**Frontend:** React 19 · TypeScript · Vite · Tailwind CSS v4 · Lucide
**IA y orquestación:** n8n · Google Gemini (modelo rápido + preciso)
**Infraestructura:** Docker Compose · Caddy (HTTPS) · Oracle Cloud Always Free
