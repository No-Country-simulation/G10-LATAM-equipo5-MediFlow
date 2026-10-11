# Logs de MediFlow: dónde están y cómo seguir una operación

MediFlow tiene tres piezas que registran lo que pasa: el **frontend** (consola del navegador), **n8n**
(servidor del workflow) y el **backend** (FastAPI). Las tres comparten un mismo **ID de seguimiento**
(`X-Request-ID`), así que una operación se sigue de punta a punta buscando ese valor.

```
Navegador ──(X-Request-ID / request_id)──► n8n ──(X-Request-ID)──► Backend
  [api] POST /users -> 201                                         [a1b2c3d4e5f6 admin_user] http: POST /api/v1/users -> 201
```

## Dónde está cada log

| Pieza | Dónde verlo | Configuración |
|---|---|---|
| Frontend | Consola del navegador (F12 → Console). `mediflow.logs()` muestra las últimas 300 entradas en tabla y `mediflow.downloadLogs()` las descarga en JSON | `VITE_LOG_LEVEL` (`debug` \| `info` \| `warn` \| `error`); por defecto `debug` en desarrollo y `warn` en producción |
| Backend (local) | La terminal donde corre `uvicorn` | `LOG_LEVEL` (`DEBUG` \| `INFO` \| `WARNING` \| `ERROR`) y `LOG_FORMAT` (`text` \| `json`) en `backend/.env` |
| Backend (producción) | `docker compose -f docker-compose.prod.yml logs -f backend` | Mismas variables en el `.env` de la raíz. Docker rota los logs (5 archivos de 10 MB por contenedor) |
| n8n: servidor | `docker logs -f mediflow-n8n` (local) o `docker compose -f docker-compose.prod.yml logs -f n8n`; además el archivo `/home/node/.n8n/logs/n8n.log`, dentro del volumen `n8n_data` (5 archivos de 16 MB) | `N8N_LOG_LEVEL` (`error` \| `warn` \| `info` \| `debug`) |
| n8n: cada ejecución | Editor de n8n → **Executions** | Solo se guardan las ejecuciones **fallidas**, durante 72 h (ver abajo) |

Para leer el archivo de n8n: `docker exec mediflow-n8n tail -f /home/node/.n8n/logs/n8n.log`.

## Cómo se lee una línea del backend

```
2026-10-09 21:14:03 WARNING [4f2a9c1e7b3d operador_user] http: POST /api/v1/documents/ingest -> 422 (10 ms)
│                   │        │            │              │     └─ mensaje
│                   │        │            │              └─ módulo (http = una línea por petición)
│                   │        │            └─ usuario autenticado (`-` si aún no hay)
│                   │        └─ ID de seguimiento
│                   └─ nivel: INFO normal, WARNING 4xx / lento (> 3 s) / seguridad, ERROR 5xx
└─ fecha y hora
```

Qué registra el backend:

- **Una línea por petición**: método, ruta, código HTTP y duración. De la query solo van los *nombres* de
  los parámetros (`/documents?page,identificacion`), nunca sus valores. Los preflight `OPTIONS` y la sonda
  `/health/live` no se registran.
- **Seguridad**: login correcto y fallido, bloqueo por intentos (`429`), refresh rechazado (incluida la
  posible reutilización de un refresh token), cierre de sesión.
- **Cambios**: alta, edición (qué campos) y eliminación de usuarios, áreas, tipos de documento y colas;
  cambio de contraseña; tomar/liberar/resolver/descartar casos de auditoría; corrección de documentos (con la
  cantidad de cambios: el detalle de cada valor queda en el historial de la base, no en el log).
- **Ingesta**: inicio, clasificación y score, posibles duplicados (`documento_id` relacionado y si es archivo
  idéntico o contenido similar), motivos de auditoría, subida a OCI, compensaciones y resultado.
- **Errores no controlados**: una sola vez, con traceback. El usuario recibe `500` con el texto
  *"Error interno del servidor. Código de seguimiento: XXXX"*, el mismo ID de la línea del log.

Con `LOG_FORMAT=json` cada línea es un objeto (`ts`, `level`, `logger`, `request_id`, `user`, `message`,
`exception`), útil si se envían los logs a un agregador (OCI Logging, Loki, etc.).

## Cómo seguir una operación

1. **El usuario reporta un error.** Si fue del servidor, el mensaje en pantalla trae el *código de
   seguimiento*. Si no, abre la consola del navegador: cada línea `[api]` muestra el `requestId`.
2. **Busca ese ID en el backend**:
   ```bash
   docker compose -f docker-compose.prod.yml logs backend | grep 4f2a9c1e7b3d
   ```
3. **Si fue una ingesta**, el mismo ID aparece en las llamadas que hizo n8n (catálogos activos e
   `/documents/ingest`). Si n8n respondió con error, el body de la respuesta trae `request_id`.
4. Para el detalle nodo a nodo de una ingesta **fallida**, abre *Executions* en el editor de n8n
   (se conservan 72 h).

## n8n: por qué no se guardan las ejecuciones exitosas

Cada ejecución de n8n contiene el archivo en base64, el token del usuario y los datos del paciente. Por
eso el workflow está configurado con `EXECUTIONS_DATA_SAVE_ON_SUCCESS=none` y las fallidas se purgan a las
72 h. El seguimiento de las ingestas exitosas se hace con el log del backend (que no guarda datos
clínicos) usando el ID de seguimiento.

Para depurar en **desarrollo** se puede activar temporalmente `EXECUTIONS_DATA_SAVE_ON_SUCCESS=all` en
`docker-compose.yml`, y `N8N_LOG_LEVEL=debug` para más detalle del servidor. No hacerlo en producción.

## Reglas para quien agregue logs

- **Nunca** registrar tokens, contraseñas, nombres de archivo ni datos de pacientes (nombre, RUT,
  diagnóstico). Sí identificadores técnicos: `documento_id`, códigos de catálogo, usernames del personal.
- Un dato que viene del usuario (ej. el username de un login fallido) pasa por `safe()` en el backend:
  elimina saltos de línea para que no se puedan falsificar líneas del log.
- Backend: `logger = logging.getLogger(__name__)` y mensajes con `%s` (no f-strings), para que el texto
  solo se arme si el nivel está activo.
- Frontend: `const log = createLogger('modulo')` desde `src/utils/logger.ts`, nunca `console.*` directo. Módulos
  en uso: `api`, `auth`, `ingesta`, `auditoria`, `correccion`, `detalle-documento`, entre otros.
