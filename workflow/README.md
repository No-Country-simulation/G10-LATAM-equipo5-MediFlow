# Workflow n8n — contrato FastAPI

Tu schema del brief (`datos_extraidos`, `Cola_Revision_Humana`) **no entra** a `POST /api/v1/documents/ingest`. FastAPI espera `IngestPayload` (`datos_generales` + `detalle_clinico` + `archivos`).

Copia original de tus archivos: [`legacy/`](legacy/).

## Qué cambió

| Brief (tu schema) | FastAPI (`IngestPayload`) |
|---|---|
| `datos_extraidos` | `datos_generales` (+ `rut` opcional) |
| tipo `Imágenes/Laboratorio` | `Informe de Laboratorio` **o** `Informe de Estudio por Imágenes` |
| `Cola_Revision_Humana` | `requiere_auditoria_humana: true` (no es una cola) |
| `Historia_Clinica_Electronica` | `Ficha_Clinica` |
| `Auditoria_Autorizaciones` | `Gestion_Procedimientos` |
| `almacenamiento_oci` | lo escribe FastAPI, no Gemini |

## Cómo importar

1. En n8n: **Import** → [`MediFlow_ingest_IngestPayload.json`](MediFlow_ingest_IngestPayload.json)
2. Conecta la credencial de Gemini en el nodo *Google Gemini Chat Model*
3. Variables de entorno de n8n:
   - `MEDIFLOW_API_BASE_URL` = `http://host.docker.internal:8000` (o la URL del backend)
   - `MEDIFLOW_API_TOKEN` = Bearer de `POST /api/v1/auth/login` (`admin_user` / `admin123`)
4. El prompt largo está en [`prompt_gemini_mediflow.md`](prompt_gemini_mediflow.md). El JSON importado lleva un resumen en el nodo *Triaje e Extracción IA*; pega el `.md` si quieres el texto completo.
5. El mapper JS (por si lo editas a mano) está en [`build_ingest_payload.js`](build_ingest_payload.js)

## Flujo

Webhook `POST /webhook/triaje-medico` → PDF/imagen → Gemini → **Armar IngestPayload** → `POST /api/v1/documents/ingest` → responde el JSON de FastAPI.

Opcional (catálogos vivos): antes de Gemini, `GET /api/v1/catalogs/document-types/active` y `GET /api/v1/catalogs/queues/active` e inyectarlos en el prompt.
