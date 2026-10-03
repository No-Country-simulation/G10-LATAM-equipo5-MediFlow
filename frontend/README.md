# MediFlow - Frontend

Módulo de interfaz de usuario para el sistema de triaje clínico automatizado y derivación hospitalaria.

## Stack Tecnológico

- **Framework:** React 19 + TypeScript (Vite)
- **Estilos:** Tailwind CSS v4
- **Iconografía:** Lucide React
- **Animaciones:** Framer Motion

## Scripts Disponibles

Dentro del directorio `frontend/`:

- `npm run dev`: Inicia el servidor local de desarrollo.
- `npm run build`: Ejecuta el chequeo de tipos (`tsc`) y compila para producción.
- `npm run lint`: Ejecuta el análisis estático de código con ESLint.

## Integración con el backend y n8n

El detalle de cada endpoint (request, respuesta y errores) está en [`backend/README.md`](../backend/README.md) y en Swagger (`/docs` con la API levantada).

| Pantalla | Llama a | Notas |
|---|---|---|
| Login | `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` | Guardar el token; `401` → volver al login, `403` → "no autorizado" |
| Carga de documento | Webhook de n8n (`multipart/form-data` + `Authorization: Bearer`) | n8n llama al backend con el token del usuario y devuelve la respuesta de `POST /documents/ingest`. El archivo principal debe ser PDF, PNG o JPG |
| Resultado | Respuesta de la ingesta | `status` es `PROCESADO` o `PENDIENTE_AUDITORIA`; mostrar `motivos_auditoria`; `detalle_clinico` trae un solo bloque, según el tipo |
| Bandeja | `GET /documents` (filtros `estado`, `prioridad`, `destino`, `rut`, fechas) | Cada fila trae `motivos_auditoria` y quién tiene el caso tomado |
| Auditoría | `POST`/`DELETE /audit/{id}/claim`, `GET /audit/{id}`, `PUT /audit/{id}/resolve`, `PUT /audit/{id}/discard` | `GET` entrega una URL pre-firmada (15 min) por archivo en `archivos[]` |
| Catálogos (solo `ADMIN`) | CRUD en `/catalogs/queues` y `/catalogs/document-types`, `/{id}/history` | El `codigo` no se puede editar |

El backend entrega **códigos** (`RECETA`, `Farmacia_Hospitalaria`). Para mostrar nombres legibles, cargar al iniciar sesión `GET /catalogs/document-types` y `GET /catalogs/queues` (sin filtro, para incluir los inactivos) y usarlos como diccionario `codigo → nombre`.

Variables de entorno propuestas (en `frontend/.env`):

| Variable | Ejemplo | Uso |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000/api/v1` | Backend (login, bandeja, auditoría, catálogos) |
| `VITE_N8N_WEBHOOK_URL` | `http://localhost:5678/webhook/mediflow/ingesta` | Carga de documentos |

> El backend acepta por CORS `http://localhost:5173` (puerto por defecto de Vite) y `http://localhost:3000`.
