# Workflow n8n — contrato FastAPI

Tu schema del brief (`datos_extraidos`, `Cola_Revision_Humana`) **no entra** a `POST /api/v1/documents/ingest`. FastAPI espera `IngestPayload` (`datos_generales` + `detalle_clinico` + `archivos`).

Copia original de tus archivos: [`legacy/`](legacy/).

## Flujo de cada ingesta

```
login → crear/reusar documento_id → leer mantenedores → procesar → POST /documents/ingest
```

1. **Token.** No uses un JWT en variable de entorno. En cada corrida *Login FastAPI* llama `POST /api/v1/auth/login` y el Bearer de esa respuesta se usa en catálogos e ingesta. El token expira; la siguiente ingesta vuelve a loguearse.
2. **Idempotencia.** *Preparar corrida* fija `documento_id` **después del login y antes de procesar**. Si el webhook ya trae `documento_id`, se reutiliza. FastAPI, con el mismo ID, actualiza el registro en vez de duplicarlo. El mapper no genera un ID nuevo al armar el POST.
3. **Mantenedores.** Tipos y colas salen de `GET /api/v1/catalogs/document-types/active` y `GET /api/v1/catalogs/queues/active` (semilla en `docker/postgres/init.sql`). La IA solo elige entre esos listados; un admin puede agregar tipos/colas sin tocar n8n.

Credenciales de **usuario/contraseña** van en el body del webhook (`api_username`, `api_password`) o se mapean desde un Credential de n8n. Nunca un `MEDIFLOW_API_TOKEN` fijo. La cuenta debe ser `ADMIN` o `AUDITOR_CLINICO` (el ingest no acepta `GESTOR_USUARIOS`).

## Cómo importar

1. En n8n: **Import** → [`MediFlow_ingest_IngestPayload.json`](MediFlow_ingest_IngestPayload.json)
2. Conecta Gemini en *Google Gemini Chat Model*
3. Webhook `POST /webhook/triaje-medico` (multipart archivo + JSON):
   - `api_base_url` (ej. `http://host.docker.internal:8000`)
   - `api_username` / `api_password` (ej. `admin_user` / `admin123` en desarrollo)
   - `documento_id` (opcional; si reintentas un fallo a mitad, manda **el mismo**)
4. Prompt largo: [`prompt_gemini_mediflow.md`](prompt_gemini_mediflow.md)
5. Mapper JS (nodo *Armar IngestPayload*): [`build_ingest_payload.js`](build_ingest_payload.js)

## Mapa brief → FastAPI

| Brief | FastAPI |
|---|---|
| `datos_extraidos` | `datos_generales` |
| tipo `Imágenes/Laboratorio` | tipo del catálogo (Laboratorio **o** Imágenes) |
| `Cola_Revision_Humana` | `requiere_auditoria_humana: true` |
| `Historia_Clinica_Electronica` | `Ficha_Clinica` |
| `almacenamiento_oci` | lo escribe FastAPI |
