# MediFlow — Frontend

Aplicación web de MediFlow: carga de documentos, bandeja, detalle con el documento original, auditoría humana, corrección con historial y administración de usuarios y catálogos.

## Stack

React 19 + TypeScript · Vite · Tailwind CSS v4 · Lucide (íconos) · Framer Motion (animaciones) · React Router.

## Puesta en marcha

Desde `frontend/` (requiere Node.js 20+ y el backend y n8n levantados, ver el [README principal](../README.md#-puesta-en-marcha)):

```bash
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
npm install
npm run dev               # http://localhost:5173
```

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Chequeo de tipos (`tsc -b`) y compilación de producción en `dist/` |
| `npm run lint` | ESLint |
| `npm run preview` | Sirve la compilación de `dist/` para probarla |

### Variables de entorno (`frontend/.env`)

| Variable | Ejemplo | Uso |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | Backend (login, bandeja, auditoría, catálogos) |
| `VITE_N8N_WEBHOOK_URL` | `http://localhost:5678/webhook/triaje-medico` | Webhook de n8n para la carga de documentos |
| `VITE_LOG_LEVEL` | `debug` | Nivel mínimo de logs en la consola (`debug` \| `info` \| `warn` \| `error`); por defecto `debug` en desarrollo y `warn` en producción |

En producción (`docker-compose.prod.yml`) no se usa este archivo: el front se compila con rutas relativas (`/api/v1`, `/webhook/triaje-medico`) y Caddy las enruta en el mismo dominio. El backend acepta por CORS `http://localhost:5173` y `http://localhost:3000`.

## Pantallas

| Ruta | Pantalla | Roles | Qué se puede hacer |
|---|---|---|---|
| `/login` | Inicio de sesión | Todos | Ingresar con usuario y contraseña |
| `/dashboard` | **Inicio** | ADMIN, AUDITOR, OPERADOR | KPIs por prioridad, carga rápida de un documento y bandeja de documentos clínicos |
| `/triaje` | **Triaje** | ADMIN, AUDITOR, OPERADOR | Casos con derivación asistencial activa, ordenados por severidad |
| `/documentos` | **Expedientes** (OPERADOR: *Mis Documentos*) | ADMIN, AUDITOR, OPERADOR | Repositorio en vista kanban o lista, con filtros por destino, prioridad e identificación |
| `/ingesta` | **Procesar Documento IA** | ADMIN, AUDITOR, OPERADOR | Subir un PDF/PNG/JPG y ver el resultado del triaje |
| `/auditoria` | **Auditoría** | ADMIN, AUDITOR | Bandeja de casos pendientes; tomar, corregir, resolver o descartar |
| `/usuarios` | **Usuarios** | ADMIN, GESTOR | CRUD de usuarios con su área |
| `/catalogos` | **Catálogos** | ADMIN (GESTOR: solo Áreas) | Mantenedores de tipos de documento, áreas y colas, con historial |

**Detalle de documento.** Al hacer clic en un documento de cualquier listado (Inicio, Triaje, Expedientes, *Ver detalle* en Auditoría o en el resumen tras procesar) se abre a pantalla completa: el **original** a la izquierda (URL pre-firmada) y los datos a la derecha (paciente, documento, diagnósticos, laboratorio, medicamentos, profesionales, posibles duplicados e historial de cambios). ADMIN y AUDITOR ven además el botón **Corregir** en documentos procesados o auditados.

**Aviso de duplicado.** Al elegir un archivo, el navegador calcula su huella SHA-256 y consulta al backend si ya existe. Si existe, muestra cuándo y desde dónde se subió, con las opciones *Ver documento*, *Subir igual* o *Cancelar*, antes de enviarlo a la IA. La huella requiere HTTPS o `localhost`: si no está disponible, se omite el aviso y el backend igual marca el duplicado al ingerir.

**Formularios por tipo de documento.** Auditoría y corrección dibujan sus campos desde los JSON Schema de `GET /catalogs/document-types/forms` (`components/common/schema-form`). Al cambiar el tipo, cambian los campos, y si se vuelve al tipo original se recupera lo que tenía.

## Estructura

```
src/
├── pages/            # Una página por ruta
├── components/
│   ├── audit/        # Panel y formulario de auditoría
│   ├── documents/    # Listados, modal de detalle, corrección e historial
│   ├── ingestion/    # Carga de archivos, aviso de duplicado y resumen del triaje
│   ├── catalogs/     # Mantenedores
│   ├── common/       # Componentes compartidos (visor de archivos, formulario por JSON Schema, modales)
│   └── layout/       # Barra de navegación y layout (aquí vive el proveedor del modal de detalle)
├── hooks/            # Estado y llamadas de cada pantalla (useClinicalForm, useDocumentDetail, ...)
├── services/         # Cliente HTTP (api.ts), autenticación, documentos, catálogos e ingesta
├── context/          # Sesión (AuthContext) y modal de detalle de documento
├── config/api.ts     # URLs del backend y de n8n
├── types/            # Tipos de la API
└── utils/            # Permisos, etiquetas legibles, logger, huella SHA-256, ...
```

## Integración con el backend y n8n

El detalle de cada endpoint está en [`backend/README.md`](../backend/README.md) y en Swagger (`/docs`).

| Pantalla | Llama a | Notas |
|---|---|---|
| Login y sesión | `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`, `POST /auth/logout` | Los tokens se guardan en `sessionStorage`. Ante un `401`, `services/api.ts` canjea el refresh token una vez y reintenta; si falla, vuelve al login. Antes de una ingesta larga se renueva el token para que no venza a mitad del proceso |
| Carga de documento | `POST /documents/duplicates/check` y luego el webhook de n8n (`multipart/form-data` con el archivo, el token y un `request_id`) | n8n responde con el resultado de `POST /documents/ingest` (timeout de 180 s) |
| Inicio, Triaje, Expedientes | `GET /documents` | Se recargan después de una corrección; Triaje y Expedientes, también al volver a la pestaña |
| Detalle de documento | `GET /documents/{id}` | Trae archivos con URL pre-firmada, detalle clínico, duplicados e historial |
| Corrección | `PUT /documents/{id}` | Mismo formulario que auditoría, con justificación obligatoria |
| Auditoría | `GET /audit/{id}`, `POST`/`DELETE /audit/{id}/claim`, `PUT /audit/{id}/resolve`, `PUT /audit/{id}/discard`, `GET /catalogs/document-types/forms` | Al abrir un caso se toma por 30 min; al cancelar se libera |
| Usuarios | `/users`, `GET /catalogs/areas/active` | El área es obligatoria |
| Catálogos | CRUD en `/catalogs/document-types`, `/catalogs/areas`, `/catalogs/queues` y `/{id}/history` | El `codigo` no se puede editar |

**Códigos legibles.** El backend entrega códigos (`LICENCIA_MEDICA`, `PENDIENTE_AUDITORIA`). `utils/etiquetas.ts` los muestra como texto normal ("Licencia Médica", "Pendiente de auditoría"); un código desconocido se muestra sin guiones bajos.

## Logs

`src/utils/logger.ts`: cada módulo crea su logger (`createLogger('ingesta')`) y en la consola del navegador `mediflow.logs()` muestra las últimas entradas y `mediflow.downloadLogs()` las descarga. Nunca se registran tokens, nombres de archivo ni datos de pacientes. Guía completa: [`docs/LOGS.md`](../docs/LOGS.md).
